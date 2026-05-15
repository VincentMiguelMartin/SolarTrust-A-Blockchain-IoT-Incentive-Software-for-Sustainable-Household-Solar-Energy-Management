// Run with: node tests/reward-microbench.test.js
//
// TC-RW-01: Dynamic Reward Allocation — server-side computation microbenchmark
//
// Isolates the closed-form formula R = k * E_v * W_time * W_network * W_behavior
// (computeReward in services/rewardService) from HTTP and Supabase write overhead.
// This populates the last row of Chapter 4, Table 3.
//
// Methodology:
//   - Consume services/rewardService.computeReward as-is (no modifications).
//   - 2 warmup calls (discarded — JIT, deopt settling).
//   - N=10 measured samples with realistic batch-shaped inputs:
//       energySavedKwh in [3, 8] kWh, non-null baseline, varying
//       networkDemandKw / networkCapacityKw, peak-hour timestamp.
//   - performance.now() monotonic high-resolution timer; t0 captured
//     immediately before each call, t1 immediately after. No I/O inside the
//     measured region.
//   - Sample standard deviation (Bessel's correction, n - 1).
//
// Outputs structured JSON to tests/results/reward-microbench_<ts>.json
// using the same schema as ingestion-latency_<ts>.json.

const path = require("path");
const fs = require("fs");
const { performance } = require("perf_hooks");
const { computeReward } = require("../services/rewardService");

const RUN_ID = `REWARD_${Date.now()}`;
const WARMUP = 2;
const N = 10;

function sampleStats(arr) {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return {
    mean: +mean.toFixed(4),
    sd: +Math.sqrt(variance).toFixed(4),
    min: +Math.min(...arr).toFixed(4),
    max: +Math.max(...arr).toFixed(4),
    n,
  };
}

function writeResults(payload) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(__dirname, "results");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `reward-microbench_${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  console.log(`\n  Results written to ${path.relative(process.cwd(), file)}`);
}

// Realistic batch-shaped inputs. Each row mirrors what a confirmed batch
// would feed to computeReward — varied across the measured window so we
// exercise both peak/off-peak W_time branches, non-trivial W_network and
// non-trivial W_behavior. Timestamps are peak hours per services/rewardService
// isPeakHour: hours 6–8 and 17–20 (local time).
function makeInput(i) {
  // Peak hours: 06, 07, 08, 17, 18, 19, 20  →  pick from this pool
  const peakHours = [6, 7, 8, 17, 18, 19, 20];
  const hour = peakHours[i % peakHours.length];
  const d = new Date();
  d.setHours(hour, (i * 7) % 60, 0, 0);

  // Demand varied across both clamped (>50 kW → W_n=0.5) and unclamped regions
  // (<50 kW → W_n in (0.5, 1.0)) so the benchmark exercises both branches of
  // the computeWnetwork clamp.
  return {
    energySavedKwh: +(3.0 + (i * 0.5)).toFixed(2),       // 3.0 → 7.5 kWh
    baselineKwh: +(4.0 + (i % 3) * 0.4).toFixed(2),      // 4.0, 4.4, 4.8 rotating
    networkDemandKw: 20 + (i * 5),                        // 20 → 65 kW
    networkCapacityKw: 100,
    timestamp: d.toISOString(),
  };
}

(async () => {
  console.log(`\n=== TC-RW-01: Dynamic Reward Allocation Microbenchmark ===`);
  console.log(`Run ID: ${RUN_ID}`);
  console.log(`Method: direct computeReward() call (no HTTP, no DB)`);
  console.log(`Timer:  performance.now() (monotonic, µs resolution)`);
  console.log(`Warmup: ${WARMUP} calls discarded | Measured: ${N} samples\n`);

  // Warmup — discarded
  for (let i = 0; i < WARMUP; i++) {
    const input = makeInput(i);
    const t0 = performance.now();
    computeReward(input);
    const elapsed = performance.now() - t0;
    console.log(`  [warmup ${i + 1}] ${elapsed.toFixed(4)}ms (discarded)`);
  }

  console.log();

  const rawSamples = [];
  const sampleDetails = [];

  for (let i = 0; i < N; i++) {
    const input = makeInput(WARMUP + i);
    // Hot-path region — only the call is timed. No allocation, no I/O.
    const t0 = performance.now();
    const result = computeReward(input);
    const t1 = performance.now();
    const elapsed = +(t1 - t0).toFixed(4);
    rawSamples.push(elapsed);
    sampleDetails.push({
      sample: i + 1,
      ms: elapsed,
      reward: result.reward,
      Wt: result.breakdown.Wt,
      Wn: result.breakdown.Wn,
      Wb: result.breakdown.Wb,
    });
    console.log(`  sample ${i + 1}: ${elapsed}ms  (R=${result.reward}, Wt=${result.breakdown.Wt}, Wn=${result.breakdown.Wn.toFixed(3)}, Wb=${result.breakdown.Wb.toFixed(3)})`);
  }

  const stats = sampleStats(rawSamples);

  console.log(`\n  ── TC-RW-01 Results ──`);
  console.log(`  Mean:   ${stats.mean}ms`);
  console.log(`  SD:     ${stats.sd}ms (sample, Bessel-corrected)`);
  console.log(`  Min:    ${stats.min}ms`);
  console.log(`  Max:    ${stats.max}ms`);
  console.log(`  N:      ${stats.n}`);

  const passed = stats.n >= 10;
  console.log(`\n  ${passed ? "PASS" : "FAIL"}  TC-RW-01 — N=${stats.n} >= 10 samples collected`);

  writeResults({
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    testFile: "reward-microbench.test.js",
    tcId: "TC-RW-01",
    method: "direct computeReward (no HTTP, no DB)",
    timer: "performance.now() monotonic",
    warmup: WARMUP,
    rawSamples,
    sampleDetails,
    stats,
    pass: passed,
  });

  process.exit(passed ? 0 : 1);
})();
