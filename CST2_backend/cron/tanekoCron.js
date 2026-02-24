const cron = require("node-cron");
const { fetchPlantLive } = require("../services/tanekoService");

const PLANT_ID = process.env.TANEKO_PLANT_ID || "TTC60011";

cron.schedule("*/5 * * * *", async () => {
  try {
    console.log(`Fetching Taneko data for ${PLANT_ID}...`);
    await fetchPlantLive(PLANT_ID);
  } catch (error) {
    console.error("[tanekoCron] Fetch failed:", error.message);
  }
});
