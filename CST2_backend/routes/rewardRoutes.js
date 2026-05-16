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

async function requireBearerUser(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(403).json({ error: error?.message || "Invalid session" });
  }

  req.user = data.user;
  next();
}

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

router.get("/:householdId", requireBearerUser, async (req, res) => {
  try {
    const { householdId } = req.params;

    const [
      energyAllRes,
      energyRecentRes,
      gameAllRes,
      gameRecentRes,
      purchasesAllRes,
      purchasesRecentRes,
      redemptionsRes,
    ] = await Promise.all([
      supabase
        .from("rewards")
        .select("reward_points")
        .eq("household_id", householdId),
      supabase
        .from("rewards")
        .select("id, batch_id, reward_points, energy_saved_kwh, computed_at")
        .eq("household_id", householdId)
        .order("computed_at", { ascending: false })
        .limit(20),
      supabase
        .from("game_sessions")
        .select("score")
        .eq("household_id", householdId),
      supabase
        .from("game_sessions")
        .select("id, score, cleanliness, completed_at")
        .eq("household_id", householdId)
        .order("completed_at", { ascending: false })
        .limit(20),
      supabase
        .from("store_purchases")
        .select("cost")
        .eq("household_id", householdId),
      supabase
        .from("store_purchases")
        .select("id, item_key, item_name, cost, purchased_at")
        .eq("household_id", householdId)
        .order("purchased_at", { ascending: false })
        .limit(20),
      supabase
        .from("reward_redemptions")
        .select("id, reward_name, points_used, status, created_at")
        .eq("plant_id", householdId)
        .neq("status", "rejected")
        .order("created_at", { ascending: false }),
    ]);

    if (energyAllRes.error) {
      return res.status(500).json({ error: energyAllRes.error.message });
    }
    if (energyRecentRes.error) {
      return res.status(500).json({ error: energyRecentRes.error.message });
    }
    if (gameAllRes.error) {
      return res.status(500).json({ error: gameAllRes.error.message });
    }
    if (gameRecentRes.error) {
      return res.status(500).json({ error: gameRecentRes.error.message });
    }
    if (purchasesAllRes.error) {
      return res.status(500).json({ error: purchasesAllRes.error.message });
    }
    if (purchasesRecentRes.error) {
      return res.status(500).json({ error: purchasesRecentRes.error.message });
    }
    if (redemptionsRes.error) {
      return res.status(500).json({ error: redemptionsRes.error.message });
    }

    const energyTotal = (energyAllRes.data || []).reduce(
      (s, r) => s + (Number(r.reward_points) || 0),
      0
    );
    const gameTotal = (gameAllRes.data || []).reduce(
      (s, r) => s + (Number(r.score) || 0),
      0
    );
    const purchasesTotal = (purchasesAllRes.data || []).reduce(
      (s, r) => s + (Number(r.cost) || 0),
      0
    );
    const redemptionsTotal = (redemptionsRes.data || []).reduce(
      (s, r) => s + (Number(r.points_used) || 0),
      0
    );
    const totalPoints =
      energyTotal + gameTotal - purchasesTotal - redemptionsTotal;

    const energyHistory = (energyRecentRes.data || []).map((r) => ({
      id: r.id,
      source: "energy",
      batch_id: r.batch_id,
      reward_points: Number(r.reward_points) || 0,
      energy_saved_kwh: Number(r.energy_saved_kwh) || 0,
      computed_at: r.computed_at,
    }));

    const gameHistory = (gameRecentRes.data || []).map((r) => ({
      id: r.id,
      source: "game",
      batch_id: null,
      reward_points: Number(r.score) || 0,
      cleanliness: Number(r.cleanliness) || 0,
      computed_at: r.completed_at,
    }));

    const purchaseHistory = (purchasesRecentRes.data || []).map((r) => ({
      id: r.id,
      source: "purchase",
      batch_id: null,
      item_key: r.item_key,
      item_name: r.item_name,
      reward_points: -(Number(r.cost) || 0),
      computed_at: r.purchased_at,
    }));

    const redemptionHistory = (redemptionsRes.data || []).map((r) => ({
      id: r.id,
      source: "redemption",
      batch_id: null,
      item_name: r.reward_name,
      status: r.status,
      reward_points: -(Number(r.points_used) || 0),
      computed_at: r.created_at,
    }));

    const history = [
      ...energyHistory,
      ...gameHistory,
      ...purchaseHistory,
      ...redemptionHistory,
    ]
      .sort((a, b) => {
        const ta = a.computed_at ? Date.parse(a.computed_at) : 0;
        const tb = b.computed_at ? Date.parse(b.computed_at) : 0;
        return tb - ta;
      })
      .slice(0, 20);

    res.json({
      householdId,
      totalPoints: Math.round(totalPoints * 100) / 100,
      history,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Catalog of redeemable items. Keep server-side so clients can't forge costs.
const STORE_ITEMS = {
  free_cleaning: { name: "Free cleaning", cost: 100 },
};

async function computeAvailablePoints(householdId) {
  const [energyRes, gameRes, purchasesRes, redemptionsRes] = await Promise.all([
    supabase
      .from("rewards")
      .select("reward_points")
      .eq("household_id", householdId),
    supabase
      .from("game_sessions")
      .select("score")
      .eq("household_id", householdId),
    supabase
      .from("store_purchases")
      .select("cost")
      .eq("household_id", householdId),
    supabase
      .from("reward_redemptions")
      .select("points_used")
      .eq("plant_id", householdId)
      .neq("status", "rejected"),
  ]);

  if (energyRes.error) throw new Error(energyRes.error.message);
  if (gameRes.error) throw new Error(gameRes.error.message);
  if (purchasesRes.error) throw new Error(purchasesRes.error.message);
  if (redemptionsRes.error) throw new Error(redemptionsRes.error.message);

  const energy = (energyRes.data || []).reduce(
    (s, r) => s + (Number(r.reward_points) || 0),
    0
  );
  const game = (gameRes.data || []).reduce(
    (s, r) => s + (Number(r.score) || 0),
    0
  );
  const spent = (purchasesRes.data || []).reduce(
    (s, r) => s + (Number(r.cost) || 0),
    0
  );
  const redeemed = (redemptionsRes.data || []).reduce(
    (s, r) => s + (Number(r.points_used) || 0),
    0
  );

  return energy + game - spent - redeemed;
}

// POST /api/rewards/purchase — redeem a store item with the user's points.
router.post("/purchase", requireBearerUser, async (req, res) => {
  try {
    const householdId = String(req.body?.householdId || "").trim();
    const itemKey = String(req.body?.itemKey || "").trim();

    if (!householdId || !itemKey) {
      return res
        .status(400)
        .json({ error: "householdId and itemKey are required" });
    }

    const item = STORE_ITEMS[itemKey];
    if (!item) {
      return res.status(400).json({ error: "Unknown item" });
    }

    const available = await computeAvailablePoints(householdId);

    if (available < item.cost) {
      return res.status(400).json({
        error: "Insufficient points",
        available: Math.round(available * 100) / 100,
        cost: item.cost,
      });
    }

    // Generate reference number: CLEAN + 6-digit random + timestamp suffix
    const refNumber = `CLEAN-${Math.random().toString().substring(2, 8).padStart(6, "0")}-${Date.now().toString().slice(-4)}`;

    const { data: inserted, error: insertError } = await supabase
      .from("store_purchases")
      .insert({
        household_id: householdId,
        item_key: itemKey,
        item_name: item.name,
        cost: item.cost,
        reference_number: refNumber,
        status: "pending_admin_approval",
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    // Create admin notification
    const { error: notifError } = await supabase
      .from("notifications")
      .insert({
        type: "purchase_request",
        title: "New Free Cleaning Request",
        message: `User from household ${householdId} has requested free cleaning service. Reference: ${refNumber}`,
        reference_number: refNumber,
        household_id: householdId,
        is_admin_only: true,
        status: "unread",
      });

    if (notifError) {
      console.warn("Failed to create admin notification:", notifError.message);
    }

    const newTotal = available - item.cost;

    res.json({
      success: true,
      purchase: inserted,
      referenceNumber: refNumber,
      status: "pending_admin_approval",
      totalPoints: Math.round(newTotal * 100) / 100,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

module.exports = router;