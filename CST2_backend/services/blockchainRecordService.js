const { createClient } = require("@supabase/supabase-js");
const { hashReading, getLatestBlock } = require("./blockfrostService");
const { buildMerkleRoot } = require("./merkleService");
const { submitBatch } = require("./blockchainService");
const { computeReward } = require("./rewardService");
const { readingsToKwh } = require("./energyConversionService");
const { getBaselineKwh } = require("./baselineService");


const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Records a single energy reading to Supabase with blockchain metadata.
 * Logs T1 (function entry) and T2 (after Supabase insert) timestamps
 * along with the T2−T1 latency in milliseconds.
 *
 * @param {string} plantId - The household/plant identifier.
 * @param {number} solarWatts - Solar generation in watts.
 * @param {number} gridWatts - Grid consumption in watts.
 * @param {number} exportWatts - Export to grid in watts.
 * @param {string} ts - ISO 8601 timestamp of the reading.
 * @returns {Promise<{readingId: string, readingHash: string, cardanoBlock: number, cardanoSlot: number}>}
 */
async function recordEnergyOnChain(plantId, solarWatts, gridWatts, exportWatts, ts) {
  const T1 = new Date();
  console.log(`[blockchainRecordService] T1 payload received: ${T1.toISOString()}`);

  const readingHash = hashReading(plantId, solarWatts, gridWatts, ts);
  const latestBlock = await getLatestBlock();

  const { data, error } = await supabase
    .from("readings")
    .insert([
      {
        household_id: plantId,
        ts,
        solar_watts: solarWatts,
        grid_watts: gridWatts,
        export_watts: exportWatts,
        reading_hash: readingHash,
        blockchain_status: "pending",
        cardano_block: latestBlock.height,
        cardano_slot: latestBlock.slot,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }

  const T2 = new Date();
  console.log(`[blockchainRecordService] T2 stored: ${T2.toISOString()}`);
  console.log(`[blockchainRecordService] IoT Ingestion Latency (T1→T2): ${T2 - T1}ms`);

  return {
    readingId: data.id,
    readingHash,
    cardanoBlock: latestBlock.height,
    cardanoSlot: latestBlock.slot,
  };
}

async function runBatch(plantId) {
  // Query all pending readings for this plant
  const { data: readings, error: queryError } = await supabase
    .from("readings")
    .select("*")
    .eq("household_id", plantId)
    .eq("blockchain_status", "pending")
    .order("ts", { ascending: true });

  if (queryError) {
    throw new Error(`Supabase query failed: ${queryError.message}`);
  }

  if (!readings || readings.length === 0) {
    console.log(`[blockchainRecordService] No pending readings for ${plantId}`);
    return null;
  }

  const periodStart = readings[0].ts;
  const periodEnd = readings[readings.length - 1].ts;
  const batchSize = readings.length;
  const readingIds = readings.map((r) => r.id);

  // Map DB rows to the format buildMerkleRoot expects
  const merkleReadings = readings.map((r) => ({
    plantId: r.household_id,
    solarWatts: r.solar_watts,
    gridWatts: r.grid_watts,
    ts: r.ts,
  }));

  const merkleRoot = buildMerkleRoot(merkleReadings);

  let txHash;
  try {
    const result = await submitBatch(plantId, merkleRoot, batchSize, periodStart, periodEnd);
    txHash = result.txHash;
  } catch (err) {
    // Mark readings as failed so they can be retried or inspected
    await supabase
      .from("readings")
      .update({ blockchain_status: "failed" })
      .in("id", readingIds);
    throw err;
  }

  // Insert batch record
  const { data: batchData, error: batchError } = await supabase
    .from("blockchain_batches")
    .insert([
      {
        plant_id: plantId,
        merkle_root: merkleRoot,
        tx_hash: txHash,
        batch_size: batchSize,
        period_start: periodStart,
        period_end: periodEnd,
        status: "confirmed",
      },
    ])
    .select()
    .single();

  if (batchError) {
    throw new Error(`Supabase batch insert failed: ${batchError.message}`);
  }

  // Update readings to confirmed
  const { error: readingsUpdateError } = await supabase
    .from("readings")
    .update({
      blockchain_status: "confirmed",
      merkle_root: merkleRoot,
      batch_id: batchData.id,
    })
    .in("id", readingIds);

    if (readingsUpdateError) {
      console.error(
        "[blockchainRecordService] Failed to update readings:",
        readingsUpdateError.message
      );
    }

    // ====== REWARD COMPUTATION ======
    // Triggered ONLY after Blockfrost confirms the batch on-chain.
    // Order matches Sir Pura's pipeline requirement: rewards fire after
    // blockchain confirmation, not before.
    let computedReward = null;
    try {
      const energySavedKwh = readingsToKwh(readings);
      const baselineKwh = await getBaselineKwh(plantId);
      const networkDemandKw = Number(process.env.NETWORK_DEMAND_KW || 0);
      const networkCapacityKw = Number(process.env.NETWORK_CAPACITY_KW || 1);

      // Use batch midpoint for W_time so the reward reflects the period,
      // not the moment the batch happened to commit.
      const midpointTs = new Date(
        (new Date(periodStart).getTime() +
          new Date(periodEnd).getTime()) / 2
      ).toISOString();

      const { reward, breakdown } = computeReward({
        energySavedKwh,
        baselineKwh,
        networkDemandKw,
        networkCapacityKw,
        timestamp: midpointTs,
      });

      const { error: rewardErr } = await supabase.from("rewards").insert([
        {
          household_id: plantId,
          batch_id: batchData.id,
          energy_saved_kwh: energySavedKwh,
          baseline_kwh: baselineKwh,
          w_time: breakdown.Wt,
          w_network: breakdown.Wn,
          w_behavior: breakdown.Wb,
          reward_points: reward,
        },
      ]);

      if (rewardErr) {
        console.error(
          "[blockchainRecordService] Reward insert failed:",
          rewardErr.message
        );
      } else {
        console.log(
          `[blockchainRecordService] Reward = ${reward} pts | ` +
          `kWh=${energySavedKwh.toFixed(3)} ` +
          `Wt=${breakdown.Wt} Wn=${breakdown.Wn.toFixed(3)} ` +
          `Wb=${breakdown.Wb.toFixed(3)} ` +
          `(baseline=${baselineKwh ?? "null"})`
        );
        computedReward = reward;
      }
    } catch (rewardError) {
      // Reward computation failure must NOT undo the on-chain commit.
      // The batch is already confirmed — just log and move on.
      console.error(
        "[blockchainRecordService] Reward computation failed:",
        rewardError.message
      );
    }

    return {
      merkleRoot,
      txHash,
      confirmed: true,
      batchSize,
      reward: computedReward,
    };
}

module.exports = { recordEnergyOnChain, runBatch };
