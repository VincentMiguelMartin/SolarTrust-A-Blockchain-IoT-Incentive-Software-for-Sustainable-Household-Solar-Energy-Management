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

// Reading-status state machine for batch commits:
//   pending    — accepted by anomaly check, not yet attempted on-chain
//   submitting — reserved into an in-flight batch (prevents concurrent batches
//                from re-picking the same rows and double-committing)
//   confirmed  — on-chain tx finalized AND batch_id linked in DB
//   failed     — last submission attempt errored before submitBatch returned;
//                safe to reclaim into the next batch
//   orphaned   — submitBatch threw a confirmation-timeout: tx may already be
//                on-chain. NEVER auto-rebatch; requires manual reconciliation.
const RECLAIMABLE_STATUSES = ["pending", "failed"];

// Per-plant in-process serialization for runBatch. Prevents the case where
// cron + a manual POST /blockchain/batch fire simultaneously and both grab
// the same pending rows, building two identical Merkle roots and double-
// committing to Cardano.
const inFlightBatches = new Map();

async function runBatch(plantId) {
  const existing = inFlightBatches.get(plantId);
  if (existing) {
    console.log(`[blockchainRecordService] Batch already running for ${plantId}; awaiting`);
    return existing;
  }
  const promise = runBatchInternal(plantId).finally(() => {
    inFlightBatches.delete(plantId);
  });
  inFlightBatches.set(plantId, promise);
  return promise;
}

async function runBatchInternal(plantId) {
  // Pick up both fresh readings AND previously-failed readings. Without the
  // `failed` clause, any reading that lost its first commit attempt would be
  // stranded forever — never re-batched, never visible in rewards.
  const { data: readings, error: queryError } = await supabase
    .from("readings")
    .select("*")
    .eq("household_id", plantId)
    .in("blockchain_status", RECLAIMABLE_STATUSES)
    .order("ts", { ascending: true });

  if (queryError) {
    throw new Error(`Supabase query failed: ${queryError.message}`);
  }

  if (!readings || readings.length === 0) {
    console.log(`[blockchainRecordService] No reclaimable readings for ${plantId}`);
    return null;
  }

  const periodStart = readings[0].ts;
  const periodEnd = readings[readings.length - 1].ts;
  const batchSize = readings.length;
  const readingIds = readings.map((r) => r.id);

  // Reserve the rows up-front. If another caller (cron, manual API, retry)
  // tries to runBatch while we're mid-flight, they will not see these rows
  // as reclaimable and cannot build a parallel commit.
  const { error: reserveError } = await supabase
    .from("readings")
    .update({ blockchain_status: "submitting" })
    .in("id", readingIds);

  if (reserveError) {
    throw new Error(`Reading reservation failed: ${reserveError.message}`);
  }

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
    // Distinguish "tx never went out" (safe to retry) from "tx submitted but
    // not yet confirmed within poll window" (must NOT retry — would double-
    // commit if it confirms later).
    const isConfirmationTimeout = /not confirmed after/i.test(String(err.message || err));
    const recoveryStatus = isConfirmationTimeout ? "orphaned" : "failed";

    await supabase
      .from("readings")
      .update({ blockchain_status: recoveryStatus })
      .in("id", readingIds);

    if (isConfirmationTimeout) {
      console.error(
        `[blockchainRecordService] Confirmation timeout for ${plantId}. ` +
        `Readings marked 'orphaned' — DO NOT auto-rebatch. Manual reconciliation required.`
      );
    }
    throw err;
  }

  // On-chain success: now insert the batch record with the real tx_hash.
  // If this insert fails the tx is already on-chain — log loudly so operators
  // can reconcile from the on-chain metadata; readings remain 'submitting'
  // (never silently re-batched) and require manual intervention.
  const { data: batchData, error: batchInsertError } = await supabase
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

  if (batchInsertError) {
    console.error(
      `[blockchainRecordService] CRITICAL: tx ${txHash} confirmed on-chain ` +
      `but batch insert failed: ${batchInsertError.message}. ` +
      `Readings ${readingIds.join(",")} stuck in 'submitting'. Manual fix required.`
    );
    throw new Error(`Batch record insert failed after on-chain commit: ${batchInsertError.message}`);
  }

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
      // Idempotency: if a reward already exists for this batch_id, skip.
      // Protects against double-credit if runBatch is ever re-invoked for
      // an already-confirmed batch (e.g., during recovery).
      const { data: existingReward } = await supabase
        .from("rewards")
        .select("id, reward_points")
        .eq("batch_id", batchData.id)
        .maybeSingle();

      if (existingReward) {
        console.log(
          `[blockchainRecordService] Reward already recorded for batch ${batchData.id}; skipping`
        );
        return {
          merkleRoot,
          txHash,
          confirmed: true,
          batchSize,
          reward: Number(existingReward.reward_points),
        };
      }

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
