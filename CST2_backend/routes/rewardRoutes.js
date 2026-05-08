const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

const { computeReward } = require("../services/rewardService");
const { getBaselineKwh } = require("../services/baselineService");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.post("/calculate", async (req, res) => {
  try {
    const {
      householdId,
      batchId,
      energySavedKwh,
      timestamp,
      networkDemandKw: bodyDemand,
      networkCapacityKw: bodyCapacity,
    } = req.body;

    if (!householdId || energySavedKwh == null || !timestamp) {
      return res.status(400).json({
        error: "householdId, energySavedKwh, timestamp are required",
      });
    }

    const networkDemandKw =
      bodyDemand != null
        ? Number(bodyDemand)
        : Number(process.env.NETWORK_DEMAND_KW || 0);

    const networkCapacityKw =
      bodyCapacity != null
        ? Number(bodyCapacity)
        : Number(process.env.NETWORK_CAPACITY_KW || 1);

    const baselineKwh = await getBaselineKwh(householdId);

    const result = computeReward({
      energySavedKwh: Number(energySavedKwh),
      baselineKwh,
      networkDemandKw,
      networkCapacityKw,
      timestamp,
    });

    const safeBatchId = batchId && UUID_RE.test(String(batchId)) ? batchId : null;

    const { data, error } = await supabase
      .from("rewards")
      .insert({
        household_id: householdId,
        batch_id: safeBatchId,
        energy_saved_kwh: Number(energySavedKwh),
        baseline_kwh: baselineKwh,
        w_time: result.breakdown.Wt,
        w_network: result.breakdown.Wn,
        w_behavior: result.breakdown.Wb,
        reward_points: result.reward,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    res.json({
      success: true,
      message: "Reward calculated and saved to Supabase.",
      reward: data,
      breakdown: result.breakdown,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.get("/:householdId", async (req, res) => {
  try {
    const { householdId } = req.params;

    const { data, error } = await supabase
      .from("rewards")
      .select("*")
      .eq("household_id", householdId)
      .order("computed_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const totalPoints = (data || []).reduce(
      (s, r) => s + (Number(r.reward_points) || 0),
      0
    );

    res.json({
      householdId,
      totalPoints: Math.round(totalPoints * 100) / 100,
      history: data || [],
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;