// Run with: node tests/e2e-pipeline.test.js
//
// End-to-End Pipeline — Batch Processing Latency, On-Chain Verification, Tamper Detection
//
// TC-BL-01: Batch processing latency (T3→T4) across N_BATCHES cycles
// TC-BL-02: On-chain metadata verification (label 674 contains correct merkleRoot)
// TC-BL-03: Tamper detection (altered reading → root mismatch)
// TC-BL-04: Blockfrost transaction fee capture (from actual API response)
//
// Each cycle: seed 3 pending readings → POST /blockchain/batch → verify → cleanup.
// Cardano confirmation polling takes ~60-120s per cycle. Default N_BATCHES=5.
//
// Expected duration: ~10-15 minutes.  Testnet cost: ~0.9 tADA.
//
// Environment:
//   - Requires running backend: npm start
//   - Preprod-only guard on BLOCKFROST_PROJECT_ID
//   - performance.now() monotonic timer
//   - Sample standard deviation (Bessel's correction)
//
// Outputs structured JSON to tests/results/e2e-pipeline_<ts>.json
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { performance } = require("perf_hooks");
const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");
const { buildMerkleRoot } = require("../services/merkleService");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const BLOCKFROST_URL = "https://cardano-preprod.blockfrost.io/api/v0";
const RUN_ID = `E2E_${Date.now()}`;
const N_BATCHES = parseInt(process.env.E2E_BATCH_COUNT, 10) || 5;
const READINGS_PER_BATCH = 3;

// ── helpers ──

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function sampleStats(arr) {
  const n = arr.length;
  if (n < 2) return { mean: arr[0] || 0, sd: 0, min: arr[0] || 0, max: arr[0] || 0, n };
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return {
    mean: +mean.toFixed(2),
    sd: +Math.sqrt(variance).toFixed(2),
    min: +Math.min(...arr).toFixed(2),
    max: +Math.max(...arr).toFixed(2),
    n,
  };
}

function writeResults(payload) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(__dirname, "results");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `e2e-pipeline_${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  console.log(`\n  Results written to ${path.relative(process.cwd(), file)}`);
}

const results = [];

async function runCheck(tcId, name, fn) {
  const t0 = performance.now();
  try {
    const detail = await fn();
    const ms = (performance.now() - t0).toFixed(2);
    console.log(`  PASS  ${tcId} — ${name} (${ms}ms)${detail ? ` :: ${detail}` : ""}`);
    results.push({ tcId, name, passed: true, detail: detail || null, durationMs: +ms });
  } catch (err) {
    const ms = (performance.now() - t0).toFixed(2);
    console.log(`  FAIL  ${tcId} — ${name} (${ms}ms) :: ${err.message}`);
    results.push({ tcId, name, passed: false, error: err.message, durationMs: +ms });
  }
}

// ── main ──

async function main() {
  // Preprod guard
  const projectId = process.env.BLOCKFROST_PROJECT_ID || "";
  if (!projectId.startsWith("preprod")) {
    console.error(`REFUSING TO RUN: BLOCKFROST_PROJECT_ID="${projectId}" is not a Preprod key.`);
    process.exit(1);
  }

  console.log(`\n=== End-to-End Pipeline — Batch Latency + On-Chain Verification ===`);
  console.log(`Run ID:          ${RUN_ID}`);
  console.log(`Batch cycles:    ${N_BATCHES}`);
  console.log(`Readings/batch:  ${READINGS_PER_BATCH}`);
  console.log(`Backend:         ${BASE_URL}`);
  console.log(`Estimated time:  ${N_BATCHES * 2}-${N_BATCHES * 3} minutes`);
  console.log(`Estimated cost:  ~${(N_BATCHES * 0.18).toFixed(2)} tADA\n`);

  const batchLatencies = [];
  const fees = [];
  const cycleDetails = [];
  const cleanupHouseholds = [];
  const cleanupTxHashes = [];
  let onChainVerified = 0;
  let tamperDetected = 0;

  for (let cycle = 1; cycle <= N_BATCHES; cycle++) {
    const cycleHH = `${RUN_ID}_C${cycle}`;
    cleanupHouseholds.push(cycleHH);

    console.log(`── Cycle ${cycle}/${N_BATCHES} (${cycleHH}) ──\n`);

    // Step 1: Seed pending readings
    const readingRows = Array.from({ length: READINGS_PER_BATCH }, (_, i) => ({
      household_id: cycleHH,
      ts: new Date(Date.now() - (READINGS_PER_BATCH - i) * 60000).toISOString(),
      solar_watts: 3500 + i * 100 + cycle * 10,
      grid_watts: 100 + i * 10,
      export_watts: 10 + i,
      blockchain_status: "pending",
    }));
    const { error: insertErr } = await supabase.from("readings").insert(readingRows);
    if (insertErr) throw new Error(`Seed failed: ${insertErr.message}`);
    console.log(`  [1] Seeded ${READINGS_PER_BATCH} pending readings`);

    // Step 2: Trigger batch — measure T3→T4
    console.log(`  [2] POST /blockchain/batch — waiting for Cardano confirmation...`);
    const t3Iso = new Date().toISOString();
    const t3 = performance.now();
    const batchRes = await axios.post(
      `${BASE_URL}/blockchain/batch`,
      { plantId: cycleHH },
      { timeout: 10 * 60 * 1000 }
    );
    const t4 = performance.now();
    const t4Iso = new Date().toISOString();
    const batchMs = +(t4 - t3).toFixed(2);
    batchLatencies.push(batchMs);

    const { merkleRoot, txHash, batchSize } = batchRes.data;
    if (txHash) cleanupTxHashes.push(txHash);
    console.log(`      Confirmed in ${(batchMs / 1000).toFixed(1)}s | txHash=${txHash?.slice(0, 16)}...`);

    // Step 3: Verify readings confirmed in DB
    const { data: confirmedRows } = await supabase
      .from("readings").select("*").eq("household_id", cycleHH);
    const allConfirmed = confirmedRows.every(r => r.blockchain_status === "confirmed");
    const allHaveRoot = confirmedRows.every(r => r.merkle_root === merkleRoot);
    console.log(`  [3] DB: all confirmed=${allConfirmed}, merkle_root populated=${allHaveRoot}`);

    // Step 4: Verify on-chain metadata (label 674)
    let onChainRoot = null;
    let feeLovelace = null;
    try {
      const { data: meta } = await axios.get(
        `${BLOCKFROST_URL}/txs/${txHash}/metadata`,
        { headers: { project_id: projectId } }
      );
      const label674 = meta.find(m => m.label === "674");
      onChainRoot = label674?.json_metadata?.merkleRoot;
      const rootMatch = onChainRoot === merkleRoot;
      if (rootMatch) onChainVerified++;
      console.log(`  [4] On-chain label 674: rootMatch=${rootMatch}`);

      // Fetch fee
      const { data: tx } = await axios.get(
        `${BLOCKFROST_URL}/txs/${txHash}`,
        { headers: { project_id: projectId } }
      );
      feeLovelace = parseInt(tx.fees, 10);
      fees.push(feeLovelace);
      console.log(`  [5] Fee: ${(feeLovelace / 1_000_000).toFixed(6)} ADA`);
    } catch (err) {
      console.log(`  [4] On-chain verification FAILED: ${err.message}`);
    }

    // Step 5: Tamper detection
    const tampered = confirmedRows.map((r, i) => ({
      plantId: r.household_id,
      solarWatts: i === 0 ? 99999 : r.solar_watts,
      gridWatts: r.grid_watts,
      ts: r.ts,
    }));
    const tamperedRoot = buildMerkleRoot(tampered);
    const tamperOk = tamperedRoot !== merkleRoot;
    if (tamperOk) tamperDetected++;
    console.log(`  [6] Tamper detection: rootChanged=${tamperOk}\n`);

    cycleDetails.push({
      cycle,
      householdId: cycleHH,
      readingsPerBatch: READINGS_PER_BATCH,
      t3Iso,
      t4Iso,
      batchMs,
      latencyS: +(batchMs / 1000).toFixed(2),
      merkleRoot,
      txHash,
      batchSize,
      allConfirmed,
      allHaveRoot,
      onChainRoot,
      onChainMatch: onChainRoot === merkleRoot,
      feeLovelace,
      feeAda: feeLovelace ? +(feeLovelace / 1_000_000).toFixed(6) : null,
      tamperDetected: tamperOk,
    });

    // Inter-cycle delay: give Lucid's UTXO cache time to settle so the next
    // batch doesn't try to spend a UTXO consumed by the tx we just confirmed.
    // Without this, fast confirmations (<30s) can cause a ConwayMempoolFailure
    // "All inputs are spent" on the next submission.
    if (cycle < N_BATCHES) {
      const settleMs = 60_000;
      console.log(`  [..] Waiting ${settleMs / 1000}s for wallet UTXO settle before next cycle...\n`);
      await new Promise((resolve) => setTimeout(resolve, settleMs));
    }
  }

  // ── Aggregate checks ──

  console.log("── Aggregate Results ──\n");

  const batchStats = sampleStats(batchLatencies);
  const feeStats = fees.length >= 2 ? sampleStats(fees) : {
    mean: fees[0] || 0, sd: 0, min: fees[0] || 0, max: fees[0] || 0, n: fees.length
  };

  await runCheck("TC-BL-01",
    `Batch latency T3→T4: N=${batchStats.n} >= 5 samples`,
    async () => {
      assert(batchStats.n >= 5, `Only ${batchStats.n} samples collected (need >= 5)`);
      return `mean=${(batchStats.mean / 1000).toFixed(1)}s sd=${(batchStats.sd / 1000).toFixed(1)}s min=${(batchStats.min / 1000).toFixed(1)}s max=${(batchStats.max / 1000).toFixed(1)}s`;
    });

  await runCheck("TC-BL-02",
    `On-chain verification: ${onChainVerified}/${N_BATCHES} label-674 roots match`,
    async () => {
      assert(onChainVerified === N_BATCHES,
        `${N_BATCHES - onChainVerified} cycle(s) failed on-chain verification`);
      return `${onChainVerified}/${N_BATCHES} verified`;
    });

  await runCheck("TC-BL-03",
    `Tamper detection: ${tamperDetected}/${N_BATCHES} altered roots differ`,
    async () => {
      assert(tamperDetected === N_BATCHES,
        `${N_BATCHES - tamperDetected} cycle(s) failed tamper detection`);
      return `${tamperDetected}/${N_BATCHES} detected`;
    });

  await runCheck("TC-BL-04",
    `Tx fee captured from Blockfrost API: N=${feeStats.n} >= 5`,
    async () => {
      assert(feeStats.n >= 5, `Only ${feeStats.n} fee samples (need >= 5)`);
      const meanAda = (feeStats.mean / 1_000_000).toFixed(6);
      const sdAda = (feeStats.sd / 1_000_000).toFixed(6);
      return `mean=${meanAda} ADA sd=${sdAda} ADA`;
    });

  // ── Summary ──

  console.log("\n── Performance Metrics ──\n");
  console.log("  Batch Latency T3→T4 (ms):");
  console.log(`    mean=${batchStats.mean}  sd=${batchStats.sd}  min=${batchStats.min}  max=${batchStats.max}  n=${batchStats.n}`);
  console.log("  Transaction Fee (lovelace):");
  console.log(`    mean=${feeStats.mean}  sd=${feeStats.sd}  min=${feeStats.min}  max=${feeStats.max}  n=${feeStats.n}`);
  console.log("  Transaction Fee (ADA):");
  console.log(`    mean=${(feeStats.mean / 1_000_000).toFixed(6)}  sd=${(feeStats.sd / 1_000_000).toFixed(6)}`);

  // Cleanup
  console.log("\n── Cleanup ──\n");
  for (const hh of cleanupHouseholds) {
    await supabase.from("readings").delete().eq("household_id", hh);
  }
  for (const txh of cleanupTxHashes) {
    await supabase.from("blockchain_batches").delete().eq("tx_hash", txh);
  }
  console.log(`  Removed ${cleanupHouseholds.length} test households, ${cleanupTxHashes.length} batch records.`);
  console.log(`  Note: ${cleanupTxHashes.length} Cardano txs are permanent (Preprod testnet).`);

  const passed = results.filter(r => r.passed).length;
  writeResults({
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    testFile: "e2e-pipeline.test.js",
    config: { nBatches: N_BATCHES, readingsPerBatch: READINGS_PER_BATCH, baseUrl: BASE_URL },
    results,
    cycleDetails,
    batchLatency: batchStats,
    transactionFee: {
      lovelace: feeStats,
      ada: {
        mean: +(feeStats.mean / 1_000_000).toFixed(6),
        sd: +(feeStats.sd / 1_000_000).toFixed(6),
        min: +(feeStats.min / 1_000_000).toFixed(6),
        max: +(feeStats.max / 1_000_000).toFixed(6),
        n: feeStats.n,
      },
    },
    summary: { total: results.length, passed, failed: results.length - passed },
  });

  console.log(`\n=== Summary: ${passed}/${results.length} passed ===`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(async (err) => {
  console.error("\n=== E2E Pipeline FAIL ===");
  console.error(err.response?.data || err.message);
  // Best-effort cleanup — Supabase's PostgrestFilterBuilder is thenable but not
  // a real Promise, so `.catch()` on the builder is undefined. Wrap in try.
  const prefix = RUN_ID;
  try {
    const { data: rows } = await supabase
      .from("readings")
      .select("household_id, merkle_root")
      .like("household_id", `${prefix}%`)
      .limit(500);
    const hhs = [...new Set((rows || []).map((r) => r.household_id))];
    const roots = [...new Set((rows || []).map((r) => r.merkle_root).filter(Boolean))];
    for (const hh of hhs) {
      try {
        await supabase.from("readings").delete().eq("household_id", hh);
      } catch (_) {}
    }
    if (roots.length) {
      try {
        await supabase.from("blockchain_batches").delete().in("merkle_root", roots);
      } catch (_) {}
    }
    console.error(`Cleanup: removed ${hhs.length} household(s) and ${roots.length} batch row(s) for ${prefix}.`);
  } catch (cleanupErr) {
    console.error(`Cleanup itself failed: ${cleanupErr.message}`);
    console.error(`Run RUN_ID=${prefix} node tests/_cleanup-failed-run.js manually.`);
  }
  process.exit(1);
});
