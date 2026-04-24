// Run with: node tests/ingestion-latency.test.js
//
// TC-IL-01: IoT Ingestion Latency (T1→T2)
//
// Calls recordEnergyOnChain DIRECTLY (bypasses HTTP) so the measurement is
// uncontaminated by Express middleware or client-side network overhead.
//
// T1 = function entry (payload received)
// T2 = after Supabase insert completes
// Includes Blockfrost getLatestBlock() call, which is part of the ingestion pipeline.
//
// Methodology:
//   - 2 warmup calls (discarded — cold connection pool, JIT)
//   - N=10 measured samples
//   - Sample standard deviation (Bessel's correction)
//   - performance.now() monotonic high-resolution timer
//   - Preprod-only guard on BLOCKFROST_PROJECT_ID
//
// Outputs structured JSON to tests/results/ingestion-latency_<ts>.json
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { performance } = require("perf_hooks");
const { createClient } = require("@supabase/supabase-js");
const { recordEnergyOnChain } = require("../services/blockchainRecordService");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const RUN_ID = `LATENCY_${Date.now()}`;
const TEST_HH = RUN_ID;
const WARMUP = 2;
const N = 10;

// ── helpers ──

function sampleStats(arr) {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1); // Bessel's correction
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
  const file = path.join(outDir, `ingestion-latency_${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  console.log(`\n  Results written to ${path.relative(process.cwd(), file)}`);
}

// ── main ──

(async () => {
  // Preprod guard
  const projectId = process.env.BLOCKFROST_PROJECT_ID || "";
  if (!projectId.startsWith("preprod")) {
    console.error(`REFUSING TO RUN: BLOCKFROST_PROJECT_ID="${projectId}" is not a Preprod key.`);
    process.exit(1);
  }

  console.log(`\n=== TC-IL-01: IoT Ingestion Latency (T1→T2) ===`);
  console.log(`Run ID: ${RUN_ID}`);
  console.log(`Method: direct recordEnergyOnChain call (no HTTP)`);
  console.log(`Timer:  performance.now() (monotonic, µs resolution)`);
  console.log(`Warmup: ${WARMUP} calls discarded | Measured: ${N} samples\n`);

  const createdIds = [];
  const rawSamples = [];

  async function callOnce(label) {
    const ts = new Date().toISOString();
    const t0 = performance.now();
    const result = await recordEnergyOnChain(TEST_HH, 1000, 100, 50, ts);
    const elapsed = performance.now() - t0;
    createdIds.push(result.readingId);
    return { label, ms: +elapsed.toFixed(2), readingId: result.readingId };
  }

  try {
    // Warmup
    for (let i = 0; i < WARMUP; i++) {
      const w = await callOnce(`warmup-${i + 1}`);
      console.log(`  [warmup ${i + 1}] ${w.ms}ms (discarded)`);
    }

    console.log();

    // Measured samples
    for (let i = 0; i < N; i++) {
      const s = await callOnce(`sample-${i + 1}`);
      rawSamples.push(s.ms);
      console.log(`  sample ${i + 1}: ${s.ms}ms`);
    }

    const stats = sampleStats(rawSamples);

    console.log(`\n  ── TC-IL-01 Results ──`);
    console.log(`  Mean:   ${stats.mean}ms`);
    console.log(`  SD:     ${stats.sd}ms (sample, Bessel-corrected)`);
    console.log(`  Min:    ${stats.min}ms`);
    console.log(`  Max:    ${stats.max}ms`);
    console.log(`  N:      ${stats.n}`);

    const passed = stats.n >= 10;
    console.log(`\n  ${passed ? "PASS" : "FAIL"}  TC-IL-01 — N=${stats.n} >= 10 samples collected`);

    writeResults({
      runId: RUN_ID,
      timestamp: new Date().toISOString(),
      testFile: "ingestion-latency.test.js",
      tcId: "TC-IL-01",
      method: "direct recordEnergyOnChain (no HTTP overhead)",
      timer: "performance.now() monotonic",
      warmup: WARMUP,
      rawSamples,
      stats,
      pass: passed,
    });

  } finally {
    // Cleanup all test readings
    if (createdIds.length) {
      await supabase.from("readings").delete().in("id", createdIds);
      console.log(`\n  Cleaned up ${createdIds.length} test readings.`);
    }
  }
})();
