const cron = require("node-cron");
const { createClient } = require("@supabase/supabase-js");
const { fetchPlantLive } = require("../services/tanekoService");
const { recordEnergyOnChain, runBatch } = require("../services/blockchainRecordService");
const { detectAnomaly } = require("../middleware/validateEnergy");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLANT_ID = process.env.TANEKO_PLANT_ID || "TTC60011";

// Every 15 minutes: fetch live IoT data and record each reading on-chain
cron.schedule("*/15 * * * *", async () => {
  try {
    console.log(`[tanekoCron] Fetching Taneko data for ${PLANT_ID}...`);
    const payload = await fetchPlantLive(PLANT_ID);

    const values = Array.isArray(payload?.values) ? payload.values : [];
    if (!values.length) {
      console.log("[tanekoCron] No values returned from Taneko.");
      return;
    }

    for (const v of values) {
      try {
        const solarWatts = Number(v.sap ?? 0);

        // Z-Score anomaly detection before storing the reading
        const check = await detectAnomaly(PLANT_ID, solarWatts);
        if (check.isAnomaly) {
          console.log(
            `[tanekoCron] Anomaly detected — reason: ${check.reason}, zScore: ${check.zScore ?? "N/A"}, value: ${solarWatts}W`
          );
          try {
            await supabase.from("anomaly_logs").insert([{
              plant_id: PLANT_ID,
              solar_watts: solarWatts,
              reason: check.reason,
              z_score: check.zScore ?? null,
              detected_at: new Date().toISOString(),
            }]);
          } catch (logErr) {
            console.error("[tanekoCron] Failed to insert anomaly log:", logErr.message);
          }
          continue;
        }

        console.log(
          `[tanekoCron] Reading accepted — solarWatts: ${solarWatts}W, zScore: ${check.zScore ?? "N/A"}`
        );

        const result = await recordEnergyOnChain(
          PLANT_ID,
          solarWatts,
          Number(v.iap ?? 0),
          Number(v.eap ?? 0),
          v.ts ?? new Date().toISOString()
        );
        console.log(
          `[tanekoCron] Recorded reading — id: ${result.readingId}, hash: ${result.readingHash}`
        );
      } catch (innerErr) {
        console.error("[tanekoCron] Failed to record reading:", innerErr.message);
      }
    }
  } catch (error) {
    console.error("[tanekoCron] Fetch failed:", error.message);
  }
});

// Every 6 hours: batch pending readings, build Merkle root, commit to Cardano
cron.schedule("0 */6 * * *", async () => {
  const T3 = new Date();
  console.log(`[tanekoCron] T3 batch start: ${T3.toISOString()}`);

  try {
    const result = await runBatch(PLANT_ID);
    if (!result) {
      console.log("[tanekoCron] No pending readings to batch. Skipping.");
      return;
    }

    const T4 = new Date();
    console.log(`[tanekoCron] T4 confirmed: ${T4.toISOString()}`);
    console.log(
      `[tanekoCron] Latency: ${T4 - T3}ms | txHash: ${result.txHash} | ` +
      `batchSize: ${result.batchSize} | reward: ${result.reward ?? "not computed"}`
    );
  } catch (err) {
    console.error("[tanekoCron] Batch cron error:", err.message);
  }
});
