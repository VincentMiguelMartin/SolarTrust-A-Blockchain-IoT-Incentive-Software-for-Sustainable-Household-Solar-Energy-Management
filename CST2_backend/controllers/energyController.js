const { fetchPlantLive } = require("../services/tanekoService");
const { validateLiveData } = require("../middleware/validateEnergy");
const { saveEnergyReading } = require("../services/supabaseService");
const { computeReward } = require("../services/rewardService");

async function syncEnergy(req, res) {
  try {
    const plantId = req.params.plantId;

    const data = await fetchPlantLive(plantId);

    if (!validateLiveData(data)) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const reading = data.values[0];
    const reward = computeReward(reading.eap);

    await saveEnergyReading({
      plant_id: plantId,
      solar_power_kw: reading.sap,
      export_kw: reading.eap,
      import_kw: reading.iap,
      timestamp: reading.ts,
      reward_points: reward
    });

    res.json({ message: "Energy synced", reward });
  } catch (error) {
    res.status(500).json({ error: "Sync failed" });
  }
}

module.exports = { syncEnergy };