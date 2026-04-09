const { createClient } = require("@supabase/supabase-js");
const { hashReading, getLatestBlock } = require("./blockfrostService");
const { buildMerkleRoot } = require("./merkleService");
const { submitBatch } = require("./blockchainService");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function recordEnergyOnChain(plantId, solarWatts, gridWatts, exportWatts, ts) {
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

  return { merkleRoot, txHash, confirmed: true, batchSize };
}

module.exports = { recordEnergyOnChain, runBatch };
