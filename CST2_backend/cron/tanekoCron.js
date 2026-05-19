const cron = require("node-cron");
const { runBatch } = require("../services/blockchainRecordService");
const { runIngestCycle } = require("../services/ingestService");

const PLANT_ID = process.env.TANEKO_PLANT_ID || "TTC60011";

// Every 15 minutes: fetch live IoT data and record each reading on-chain.
// Shares runIngestCycle with the POST /ingest route so the two can't drift.
cron.schedule("*/15 * * * *", async () => {
  try {
    await runIngestCycle(PLANT_ID);
  } catch (error) {
    console.error("[tanekoCron] Ingest cycle failed:", error.message);
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
