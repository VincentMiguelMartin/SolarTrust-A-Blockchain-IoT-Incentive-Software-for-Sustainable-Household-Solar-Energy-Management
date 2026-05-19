/**
 * Tamper-Evidence Verification — Live Defense Demo.
 *
 * Pulls a CONFIRMED batch's readings from Supabase, recomputes the Merkle
 * root from their CURRENT values, then fetches the root that was anchored
 * on Cardano (Blockfrost metadata label 674) and compares the two.
 *
 *   - Roots MATCH    -> off-chain data is intact.
 *   - Roots MISMATCH -> a reading was altered after it was committed.
 *
 * The on-chain root is read straight from Cardano, not from Supabase, so
 * editing the DB cannot hide the tampering.
 *
 * Usage:
 *   node scripts/verifyBatch.js               # latest confirmed batch (default plant)
 *   node scripts/verifyBatch.js <batchId>     # a specific blockchain_batches.id
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BLOCKFROST_PROJECT_ID,
 *      BLOCKFROST_NETWORK (default preprod), TANEKO_PLANT_ID (default TTC60011)
 */
require("dotenv").config();

const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const { buildMerkleRoot } = require("../services/merkleService");

const PLANT_ID = process.env.TANEKO_PLANT_ID || "TTC60011";
const NETWORK = process.env.BLOCKFROST_NETWORK || "preprod";
const BLOCKFROST_URL =
  NETWORK === "mainnet"
    ? "https://cardano-mainnet.blockfrost.io/api/v0"
    : `https://cardano-${NETWORK}.blockfrost.io/api/v0`;

const argBatchId = process.argv[2] || null;

function banner(text, char = "=") {
  const line = char.repeat(64);
  console.log(`\n${line}\n  ${text}\n${line}`);
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  if (!process.env.BLOCKFROST_PROJECT_ID) {
    throw new Error("BLOCKFROST_PROJECT_ID is required");
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── 1. Resolve the batch to verify ───────────────────────────
  let batchQuery = supabase
    .from("blockchain_batches")
    .select("id, plant_id, merkle_root, tx_hash, batch_size, period_start, period_end, status");

  if (argBatchId) {
    batchQuery = batchQuery.eq("id", argBatchId);
  } else {
    batchQuery = batchQuery
      .eq("plant_id", PLANT_ID)
      .eq("status", "confirmed")
      .order("period_end", { ascending: false })
      .limit(1);
  }

  const { data: batches, error: batchErr } = await batchQuery;
  if (batchErr) throw new Error(`Batch query failed: ${batchErr.message}`);
  if (!batches || batches.length === 0) {
    throw new Error(
      argBatchId
        ? `No batch with id ${argBatchId}`
        : `No confirmed batches for plant ${PLANT_ID}`
    );
  }

  const batch = batches[0];

  banner("SolarTrust — On-Chain Tamper-Evidence Check");
  console.log(`  Batch ID    : ${batch.id}`);
  console.log(`  Plant       : ${batch.plant_id}`);
  console.log(`  Period      : ${batch.period_start}  ->  ${batch.period_end}`);
  console.log(`  Batch size  : ${batch.batch_size}`);
  console.log(`  Cardano tx  : ${batch.tx_hash}`);

  // ── 2. Pull the batch's readings (CURRENT DB values) ─────────
  // Same selection order runBatch used to build the original root:
  // readings for this batch, ascending by ts.
  const { data: readings, error: readErr } = await supabase
    .from("readings")
    .select("household_id, solar_watts, grid_watts, ts")
    .eq("batch_id", batch.id)
    .order("ts", { ascending: true });

  if (readErr) throw new Error(`Readings query failed: ${readErr.message}`);
  if (!readings || readings.length === 0) {
    throw new Error(`No readings linked to batch ${batch.id}`);
  }

  const recomputedRoot = buildMerkleRoot(
    readings.map((r) => ({
      plantId: r.household_id,
      solarWatts: r.solar_watts,
      gridWatts: r.grid_watts,
      ts: r.ts,
    }))
  );

  // ── 3. Fetch the root anchored on Cardano (label 674) ────────
  const { data: meta } = await axios.get(
    `${BLOCKFROST_URL}/txs/${batch.tx_hash}/metadata`,
    { headers: { project_id: process.env.BLOCKFROST_PROJECT_ID } }
  );

  const label674 = (meta || []).find((m) => String(m.label) === "674");
  if (!label674) {
    throw new Error(
      `Transaction ${batch.tx_hash} has no metadata under label 674`
    );
  }
  const onChainRoot = label674.json_metadata?.merkleRoot;
  if (!onChainRoot) {
    throw new Error("Label 674 metadata has no merkleRoot field");
  }

  // ── 4. Compare ───────────────────────────────────────────────
  console.log(`\n  Recomputed root (from ${readings.length} current DB readings):`);
  console.log(`    ${recomputedRoot}`);
  console.log(`  On-chain root (Cardano ${NETWORK}, metadata 674):`);
  console.log(`    ${onChainRoot}`);
  console.log(`  Supabase-stored root (reference only):`);
  console.log(`    ${batch.merkle_root}`);

  const intact = recomputedRoot === onChainRoot;

  if (intact) {
    banner("RESULT: MATCH  —  data is intact, not tampered", "=");
    console.log(
      "  Every reading hashes back to the exact root anchored on Cardano.\n"
    );
    process.exit(0);
  } else {
    banner("RESULT: MISMATCH  —  TAMPERING DETECTED", "!");
    console.log(
      "  The off-chain readings no longer hash to the on-chain root.\n" +
      "  At least one reading was altered after it was committed.\n" +
      "  The Cardano anchor is immutable, so the change cannot be hidden.\n"
    );
    process.exit(1);
  }
}

main().catch((err) => {
  banner("VERIFICATION ERROR", "!");
  console.error(`  ${err.message}\n`);
  process.exit(2);
});
