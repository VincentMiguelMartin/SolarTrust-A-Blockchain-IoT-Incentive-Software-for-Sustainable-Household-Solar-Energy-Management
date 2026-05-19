const { createClient } = require("@supabase/supabase-js");
const { fetchPlantLive } = require("./tanekoService");
const { recordEnergyOnChain } = require("./blockchainRecordService");
const { detectAnomaly } = require("../middleware/validateEnergy");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Runs one full ingest cycle for a plant: fetch live Taneko data, screen
 * each reading with Z-Score anomaly detection, log rejects to anomaly_logs,
 * and record accepted readings on-chain (pending).
 *
 * This is the single source of truth for the ingest loop — used both by the
 * 15-minute tanekoCron and by the POST /ingest HTTP route, so the two can
 * never drift apart.
 *
 * @param {string} plantId
 * @returns {Promise<{plantId: string, fetched: number, recorded: Array, anomalies: Array}>}
 */
async function runIngestCycle(plantId) {
  console.log(`[ingest] Fetching Taneko data for ${plantId}...`);
  const payload = await fetchPlantLive(plantId);

  const values = Array.isArray(payload?.values) ? payload.values : [];
  const recorded = [];
  const anomalies = [];

  if (!values.length) {
    console.log("[ingest] No values returned from Taneko.");
    return { plantId, fetched: 0, recorded, anomalies };
  }

  for (const v of values) {
    try {
      const solarWatts = Number(v.sap ?? 0);

      // Z-Score anomaly detection before storing the reading
      const check = await detectAnomaly(plantId, solarWatts);
      if (check.isAnomaly) {
        console.log(
          `[ingest] Anomaly detected — reason: ${check.reason}, zScore: ${check.zScore ?? "N/A"}, value: ${solarWatts}W`
        );
        try {
          await supabase.from("anomaly_logs").insert([
            {
              plant_id: plantId,
              solar_watts: solarWatts,
              reason: check.reason,
              z_score: check.zScore ?? null,
              detected_at: new Date().toISOString(),
            },
          ]);
        } catch (logErr) {
          console.error("[ingest] Failed to insert anomaly log:", logErr.message);
        }
        anomalies.push({
          solarWatts,
          reason: check.reason,
          zScore: check.zScore ?? null,
        });
        continue;
      }

      console.log(
        `[ingest] Reading accepted — solarWatts: ${solarWatts}W, zScore: ${check.zScore ?? "N/A"}`
      );

      const result = await recordEnergyOnChain(
        plantId,
        solarWatts,
        Number(v.iap ?? 0),
        Number(v.eap ?? 0),
        v.ts ?? new Date().toISOString()
      );
      console.log(
        `[ingest] Recorded reading — id: ${result.readingId}, hash: ${result.readingHash}`
      );
      recorded.push({
        readingId: result.readingId,
        readingHash: result.readingHash,
        solarWatts,
      });
    } catch (innerErr) {
      console.error("[ingest] Failed to record reading:", innerErr.message);
    }
  }

  return { plantId, fetched: values.length, recorded, anomalies };
}

module.exports = { runIngestCycle };
