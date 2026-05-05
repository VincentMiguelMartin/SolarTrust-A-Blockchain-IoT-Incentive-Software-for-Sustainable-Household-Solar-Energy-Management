/**
 * Computes the 30-day rolling baseline used by W_behavior in the reward formula.
 *
 * Baseline = average energySavedKwh across the household's previous confirmed
 * reward batches in the last 30 days. Returns null when fewer than
 * MIN_BATCHES_FOR_BASELINE batches exist — the reward function falls back to
 * W_behavior = 1.0 in that case.
 */

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MIN_BATCHES_FOR_BASELINE = 5;
const BASELINE_WINDOW_DAYS = 30;

async function getBaselineKwh(householdId) {
  const cutoff = new Date(
    Date.now() - BASELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("rewards")
    .select("energy_saved_kwh")
    .eq("household_id", householdId)
    .gte("computed_at", cutoff);

  if (error) {
    console.error("[baselineService] Query failed:", error.message);
    return null;
  }

  if (!data || data.length < MIN_BATCHES_FOR_BASELINE) {
    return null;
  }

  const sum = data.reduce((s, r) => s + (Number(r.energy_saved_kwh) || 0), 0);
  return sum / data.length;
}

module.exports = { getBaselineKwh };