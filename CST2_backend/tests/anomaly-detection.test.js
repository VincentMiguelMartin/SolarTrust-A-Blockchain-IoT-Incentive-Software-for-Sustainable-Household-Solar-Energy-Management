// Run with: node tests/anomaly-detection.test.js
//
// Anomaly Detection — Functional Correctness + F1-Score
//
// Part A (TC-AD-01..TC-AD-08): individual-case validation against seeded history.
// Part B (TC-AD-F1):           ground-truth dataset (50 readings: 30 normal, 20 anomalous),
//                              TP/FP/FN counting, F1 assertion >= 0.80.
//
// Outputs structured JSON to tests/results/anomaly-detection_<ts>.json
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { performance } = require("perf_hooks");
const { createClient } = require("@supabase/supabase-js");
const { detectAnomaly } = require("../middleware/validateEnergy");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const RUN_ID = `ANOMALY_${Date.now()}`;
const TEST_HH = `${RUN_ID}_MAIN`;
const F1_THRESHOLD = 0.80;

const results = [];

// ── helpers ──

function assert(cond, msg) { if (!cond) throw new Error(msg); }

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

async function seedHistory(householdId, values) {
  const rows = values.map((v, i) => ({
    household_id: householdId,
    ts: new Date(Date.now() - (values.length - i) * 60000).toISOString(),
    solar_watts: v,
    grid_watts: 0,
    blockchain_status: "pending",
  }));
  const { error } = await supabase.from("readings").insert(rows);
  if (error) throw new Error(`Seed failed: ${error.message}`);
}

async function cleanup(householdId) {
  await supabase.from("readings").delete().eq("household_id", householdId);
}

function writeResults(extra) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(__dirname, "results");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `anomaly-detection_${ts}.json`);
  const payload = {
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    testFile: "anomaly-detection.test.js",
    results,
    ...extra,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  console.log(`\n  Results written to ${path.relative(process.cwd(), file)}`);
}

// ── main ──

async function main() {
  console.log("=== Anomaly Detection — Functional Tests + F1-Score ===");
  console.log(`Run ID: ${RUN_ID}\n`);

  // Seed baseline: 30 readings, mean ≈ 3400, sd ≈ 198
  const normalHistory = [];
  for (let i = 0; i < 30; i++) {
    const v = 3400 + Math.round(((i % 7) - 3) * 100 + Math.sin(i) * 50);
    normalHistory.push(v);
  }
  const histMean = normalHistory.reduce((s, v) => s + v, 0) / normalHistory.length;
  const histSd = Math.sqrt(normalHistory.reduce((s, v) => s + (v - histMean) ** 2, 0) / normalHistory.length);
  console.log(`  Baseline: N=${normalHistory.length}, mean=${histMean.toFixed(1)}, sd=${histSd.toFixed(1)}\n`);

  await seedHistory(TEST_HH, normalHistory);

  try {
    // ── Part A: individual-case validation ──

    console.log("── Part A: Individual Cases ──\n");

    // TC-AD-01: Normal reading within bounds
    await runCheck("TC-AD-01", "Normal 3500W accepted", async () => {
      const r = await detectAnomaly(TEST_HH, 3500);
      assert(r.isAnomaly === false, `Expected normal, got anomaly: ${r.reason}`);
      return `z=${r.zScore?.toFixed(2) ?? "N/A"}`;
    });

    // TC-AD-02: Negative value (physically impossible)
    await runCheck("TC-AD-02", "Negative -50W flagged (physical bounds)", async () => {
      const r = await detectAnomaly(TEST_HH, -50);
      assert(r.isAnomaly === true, "Expected anomaly");
      assert(/negative/i.test(r.reason), `Reason missing 'negative': ${r.reason}`);
      return r.reason;
    });

    // TC-AD-03: Exceeds max panel capacity
    await runCheck("TC-AD-03", "99999W exceeds physical max", async () => {
      const r = await detectAnomaly(TEST_HH, 99999);
      assert(r.isAnomaly === true, "Expected anomaly");
      assert(/max|physical|capacity/i.test(r.reason), `Reason missing capacity: ${r.reason}`);
      return r.reason;
    });

    // TC-AD-04: Z-score > 3 (statistical outlier)
    await runCheck("TC-AD-04", "12000W flagged as z-score outlier", async () => {
      const r = await detectAnomaly(TEST_HH, 12000);
      assert(r.isAnomaly === true, "Expected anomaly");
      assert(/z-?score/i.test(r.reason), `Reason missing z-score: ${r.reason}`);
      return `z=${r.zScore?.toFixed(2)}`;
    });

    // TC-AD-05: Z-score at exact boundary — threshold is exclusive (>3, not >=3)
    await runCheck("TC-AD-05", "Boundary value (mean + 3*sd) → anomaly (>3 exclusive)", async () => {
      const boundaryVal = Math.round(histMean + 3 * histSd);
      const r = await detectAnomaly(TEST_HH, boundaryVal);
      // Math.round overshoots by a fraction, so z ≈ 3.002 → flagged
      assert(r.isAnomaly === true,
        `Expected anomaly at val=${boundaryVal} (z=${r.zScore?.toFixed(4)}). ` +
        `Threshold is EXCLUSIVE (>3). Got: ${r.reason}`);
      return `val=${boundaryVal}, z=${r.zScore?.toFixed(4)}, threshold=EXCLUSIVE >3`;
    });

    // TC-AD-06: Insufficient historical data (<MIN_READINGS=5)
    await runCheck("TC-AD-06", "Insufficient history (<5) → graceful accept", async () => {
      const SPARSE_HH = `${RUN_ID}_SPARSE`;
      const rows = [1000, 2000, 3000].map((v, i) => ({
        household_id: SPARSE_HH,
        ts: new Date(Date.now() - (3 - i) * 60000).toISOString(),
        solar_watts: v, grid_watts: 0, blockchain_status: "pending",
      }));
      await supabase.from("readings").insert(rows);
      try {
        const r = await detectAnomaly(SPARSE_HH, 5000);
        assert(r.isAnomaly === false, `Expected accept, got: ${r.reason}`);
        assert(/insufficient/i.test(r.reason), `Reason missing 'insufficient': ${r.reason}`);
        return r.reason;
      } finally {
        await cleanup(SPARSE_HH);
      }
    });

    // TC-AD-07: Zero stddev (all identical readings) — division-by-zero guard
    await runCheck("TC-AD-07", "Zero stddev → no crash, accepts", async () => {
      const IDENT_HH = `${RUN_ID}_IDENT`;
      const rows = Array.from({ length: 10 }, (_, i) => ({
        household_id: IDENT_HH,
        ts: new Date(Date.now() - (10 - i) * 60000).toISOString(),
        solar_watts: 3000, grid_watts: 0, blockchain_status: "pending",
      }));
      await supabase.from("readings").insert(rows);
      try {
        const r = await detectAnomaly(IDENT_HH, 3001);
        assert(r.isAnomaly === false, `Expected accept, got: ${r.reason}`);
        assert(/StdDev is 0/i.test(r.reason), `Reason missing stddev guard: ${r.reason}`);
        return r.reason;
      } finally {
        await cleanup(IDENT_HH);
      }
    });

    // TC-AD-08: 0W nighttime against daytime-only history → z-score outlier (expected)
    await runCheck("TC-AD-08", "0W nighttime → z-score anomaly against daytime baseline", async () => {
      const r = await detectAnomaly(TEST_HH, 0);
      // 0W against mean=3400 sd=198 → z ≈ 17 → correctly flagged as outlier.
      // This is expected behavior: nighttime 0W readings are statistically anomalous
      // against a daytime-only baseline. In production the rolling window naturally
      // absorbs night values as they accumulate.
      assert(r.isAnomaly === true,
        `Expected anomaly (0W vs daytime mean=${histMean.toFixed(0)}), got: ${r.reason}`);
      assert(/z-?score/i.test(r.reason), `Expected z-score reason, got: ${r.reason}`);
      return `z=${r.zScore?.toFixed(2)}, reason=${r.reason}`;
    });

    // ── Part B: F1-Score on ground-truth dataset ──

    console.log("\n── Part B: F1-Score (ground-truth dataset) ──\n");

    // Build 50 labeled readings: 30 normal + 20 anomalous
    // The baseline history is already seeded (mean ≈ 3400, sd ≈ 198).
    // detectAnomaly only READS from DB — these test readings are not inserted,
    // so the baseline remains stable across all 50 evaluations.

    const groundTruth = [];

    // 30 normal readings: within physical bounds AND |z| < 3
    for (let i = 0; i < 30; i++) {
      // Values between mean-2σ and mean+2σ → z ∈ [-2, 2]
      const val = Math.round(histMean + ((i / 29) * 4 - 2) * histSd * 0.9);
      groundTruth.push({ solarWatts: val, expectedAnomaly: false, category: "normal" });
    }

    // 5 anomalous: negative (physical bounds)
    for (let i = 0; i < 5; i++) {
      groundTruth.push({ solarWatts: -(i + 1) * 10, expectedAnomaly: true, category: "negative" });
    }

    // 5 anomalous: over-capacity (physical bounds)
    for (let i = 0; i < 5; i++) {
      groundTruth.push({ solarWatts: 25000 + i * 5000, expectedAnomaly: true, category: "over-capacity" });
    }

    // 10 anomalous: z-score outliers (within physical bounds but |z| > 3)
    for (let i = 0; i < 5; i++) {
      // High outliers: mean + (4+i)*sd → z ∈ [4, 8]
      const high = Math.round(histMean + (4 + i) * histSd);
      groundTruth.push({ solarWatts: Math.min(high, 19999), expectedAnomaly: true, category: "z-high" });
    }
    for (let i = 0; i < 5; i++) {
      // Low outliers: mean - (4+i)*sd → z ∈ [4, 8], clamped to 1 (above physical-bounds floor)
      const low = Math.round(histMean - (4 + i) * histSd);
      groundTruth.push({ solarWatts: Math.max(low, 1), expectedAnomaly: true, category: "z-low" });
    }

    let tp = 0, fp = 0, fn = 0, tn = 0;
    const f1Details = [];

    for (const gt of groundTruth) {
      const r = await detectAnomaly(TEST_HH, gt.solarWatts);
      const predicted = r.isAnomaly;
      const expected = gt.expectedAnomaly;

      if (predicted && expected)       tp++;
      else if (predicted && !expected)  fp++;
      else if (!predicted && expected)  fn++;
      else                              tn++;

      f1Details.push({
        solarWatts: gt.solarWatts,
        category: gt.category,
        expectedAnomaly: expected,
        predictedAnomaly: predicted,
        correct: predicted === expected,
        reason: r.reason,
        zScore: r.zScore ?? null,
      });
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

    const misclassified = f1Details.filter(d => !d.correct);

    console.log(`  Dataset:   ${groundTruth.length} readings (${groundTruth.filter(g => !g.expectedAnomaly).length} normal, ${groundTruth.filter(g => g.expectedAnomaly).length} anomalous)`);
    console.log(`  TP=${tp}  FP=${fp}  FN=${fn}  TN=${tn}`);
    console.log(`  Precision: ${(precision * 100).toFixed(1)}%`);
    console.log(`  Recall:    ${(recall * 100).toFixed(1)}%`);
    console.log(`  F1-Score:  ${(f1 * 100).toFixed(1)}%`);
    console.log(`  Threshold: F1 >= ${(F1_THRESHOLD * 100).toFixed(0)}%`);

    if (misclassified.length > 0) {
      console.log(`\n  Misclassified readings (${misclassified.length}):`);
      for (const m of misclassified) {
        console.log(`    solarWatts=${m.solarWatts} category=${m.category} expected=${m.expectedAnomaly} predicted=${m.predictedAnomaly} reason="${m.reason}" z=${m.zScore?.toFixed(2) ?? "N/A"}`);
      }
    }

    await runCheck("TC-AD-F1", `F1-Score >= ${(F1_THRESHOLD * 100).toFixed(0)}%`, async () => {
      assert(f1 >= F1_THRESHOLD,
        `F1=${(f1 * 100).toFixed(1)}% < ${(F1_THRESHOLD * 100).toFixed(0)}% threshold. ` +
        `TP=${tp} FP=${fp} FN=${fn} TN=${tn}`);
      return `F1=${(f1 * 100).toFixed(1)}% (P=${(precision * 100).toFixed(1)}%, R=${(recall * 100).toFixed(1)}%)`;
    });

    // Write structured results
    const passed = results.filter(r => r.passed).length;
    writeResults({
      baseline: { n: normalHistory.length, mean: histMean, sd: histSd },
      f1Score: { tp, fp, fn, tn, precision, recall, f1, threshold: F1_THRESHOLD, pass: f1 >= F1_THRESHOLD },
      f1Details,
      summary: { total: results.length, passed, failed: results.length - passed },
    });

    console.log(`\n=== Summary: ${passed}/${results.length} passed ===`);
    process.exit(passed === results.length ? 0 : 1);

  } finally {
    await cleanup(TEST_HH);
  }
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  await cleanup(TEST_HH).catch(() => {});
  process.exit(1);
});
