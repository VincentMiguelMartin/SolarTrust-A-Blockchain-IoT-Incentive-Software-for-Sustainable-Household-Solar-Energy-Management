/**
 * Algorithm Performance Testing — Anomaly Injection (Section 3.7.3.1).
 *
 * Injects a controlled mix of normal and anomalous solar readings into the
 * POST /readings pipeline, then queries anomaly_logs to compute
 * Precision, Recall, and F1-Score against ground-truth labels.
 *
 * Usage:
 *   node scripts/injectAnomalies.js
 *
 * Env:
 *   TANEKO_PLANT_ID (default: TTC60011)
 *   BACKEND_URL     (default: http://localhost:3000)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required for log query)
 */
require("dotenv").config();
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const PLANT_ID = process.env.TANEKO_PLANT_ID || "TTC60011";
const BASE_URL = process.env.BACKEND_URL || "http://localhost:3000";

const F1_THRESHOLD = 0.80;
const POST_DELAY_MS = 300;
const SETTLE_DELAY_MS = 2000;

const dataset = [
  { solarWatts: 300, label: "normal" },
  { solarWatts: 320, label: "normal" },
  { solarWatts: 310, label: "normal" },
  { solarWatts: 290, label: "normal" },
  { solarWatts: 305, label: "normal" },
  { solarWatts: 315, label: "normal" },
  { solarWatts: 308, label: "normal" },
  { solarWatts: 298, label: "normal" },
  { solarWatts: 312, label: "normal" },
  { solarWatts: 302, label: "normal" },
  { solarWatts: 318, label: "normal" },
  { solarWatts: 295, label: "normal" },
  { solarWatts: -50, label: "anomaly" },
  { solarWatts: 25000, label: "anomaly" },
  { solarWatts: 9999, label: "anomaly" },
  { solarWatts: -1, label: "anomaly" },
  { solarWatts: 30000, label: "anomaly" },
  { solarWatts: 8888, label: "anomaly" },
  { solarWatts: -100, label: "anomaly" },
  { solarWatts: 15000, label: "anomaly" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fmtMetric = (value) =>
  value === null || value === undefined || Number.isNaN(value)
    ? "N/A"
    : value.toFixed(4);

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[injectAnomalies] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const startTime = new Date();

  console.log("=== Anomaly Injection — F1-Score Test ===");
  console.log(`Run started:   ${startTime.toISOString()}`);
  console.log(`PLANT_ID:      ${PLANT_ID}`);
  console.log(`BACKEND_URL:   ${BASE_URL}`);
  console.log(`Dataset:       ${dataset.length} readings ` +
    `(${dataset.filter((d) => d.label === "normal").length} normal, ` +
    `${dataset.filter((d) => d.label === "anomaly").length} anomaly)`);
  console.log("");

  const normalValues = dataset
    .filter((r) => r.label === "normal")
    .map((r) => r.solarWatts);
  const anomalyValues = dataset
    .filter((r) => r.label === "anomaly")
    .map((r) => r.solarWatts);

  console.log("── Injecting readings ──");
  for (let i = 0; i < dataset.length; i++) {
    const reading = dataset[i];
    const body = {
      plantId: PLANT_ID,
      solarWatts: reading.solarWatts,
      gridWatts: 0,
      exportWatts: 0,
      ts: new Date().toISOString(),
    };
    try {
      const res = await axios.post(`${BASE_URL}/readings`, body, {
        validateStatus: () => true,
        timeout: 10000,
      });
      console.log(
        `  [${String(i + 1).padStart(2, "0")}/${dataset.length}] ` +
        `solarWatts=${reading.solarWatts} (${reading.label}) -> HTTP ${res.status}`
      );
    } catch (err) {
      console.log(
        `  [${String(i + 1).padStart(2, "0")}/${dataset.length}] ` +
        `solarWatts=${reading.solarWatts} (${reading.label}) -> ERROR ${err.message}`
      );
    }
    await sleep(POST_DELAY_MS);
  }

  console.log(`\n[injectAnomalies] Settling for ${SETTLE_DELAY_MS}ms...`);
  await sleep(SETTLE_DELAY_MS);

  console.log("[injectAnomalies] Querying anomaly_logs...");
  const { data: logs, error } = await supabase
    .from("anomaly_logs")
    .select("solar_watts, detected_at, reason, z_score")
    .eq("plant_id", PLANT_ID)
    .gte("detected_at", startTime.toISOString());

  if (error) {
    console.error("[injectAnomalies] Supabase query failed:", error.message);
    process.exitCode = 1;
    return;
  }

  const detected = (logs || []).map((row) => ({
    solarWatts: Number(row.solar_watts),
    reason: row.reason,
    zScore: row.z_score,
    detectedAt: row.detected_at,
  }));

  let tp = 0;
  let fp = 0;
  for (const row of detected) {
    if (anomalyValues.includes(row.solarWatts)) {
      tp++;
    } else if (normalValues.includes(row.solarWatts)) {
      fp++;
    }
  }
  const fn = anomalyValues.length - tp;
  const tn = normalValues.length - fp;

  const precisionDen = tp + fp;
  const recallDen = tp + fn;
  const precision = precisionDen > 0 ? tp / precisionDen : null;
  const recall = recallDen > 0 ? tp / recallDen : null;

  let f1 = null;
  if (precision !== null && recall !== null && (precision + recall) > 0) {
    f1 = (2 * precision * recall) / (precision + recall);
  }

  console.log("\n========== ANOMALY DETECTION RESULTS ==========");
  console.log(`Detected entries since run start: ${detected.length}`);
  if (detected.length > 0) {
    console.log("Detected solar_watts values: " +
      detected.map((d) => d.solarWatts).join(", "));
  }
  console.log("");
  console.log(`TP (true positive)  = ${tp}`);
  console.log(`FP (false positive) = ${fp}`);
  console.log(`FN (false negative) = ${fn}`);
  console.log(`TN (true negative)  = ${tn}`);
  console.log("");
  console.log(`Precision = ${fmtMetric(precision)}`);
  console.log(`Recall    = ${fmtMetric(recall)}`);
  console.log(`F1-Score  = ${fmtMetric(f1)}`);
  console.log(`Threshold:  F1 >= ${F1_THRESHOLD.toFixed(2)}`);
  console.log("================================================\n");

  if (f1 !== null && f1 >= F1_THRESHOLD) {
    console.log(`[injectAnomalies] PASS: F1 = ${f1.toFixed(4)} >= ${F1_THRESHOLD}`);
    process.exitCode = 0;
  } else {
    console.log(`[injectAnomalies] FAIL: F1 = ${fmtMetric(f1)} < ${F1_THRESHOLD}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[injectAnomalies] FATAL:", err);
  process.exitCode = 1;
});
