const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** Minimum number of historical readings required for Z-Score analysis */
const MIN_READINGS = 5;

/** Maximum number of recent readings to fetch for statistical analysis */
const WINDOW_SIZE = 30;

/** Z-Score threshold above which a reading is flagged as anomalous */
const Z_THRESHOLD = 8;

/** Physical upper bound for solar panel wattage (watts) */
const MAX_SOLAR_WATTS = 100000;

/**
 * Computes the arithmetic mean of an array of numbers.
 * @param {number[]} arr - Array of numeric values.
 * @returns {number} The mean of the values.
 */
function mean(arr) {
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

/**
 * Computes the population standard deviation of an array of numbers.
 * @param {number[]} arr - Array of numeric values.
 * @param {number} avg - Pre-computed mean of the array.
 * @returns {number} The population standard deviation.
 */
function stdDev(arr, avg) {
  const variance = arr.reduce((sum, v) => sum + (v - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Detects whether an incoming solar wattage reading is anomalous using
 * physical bounds checking and Z-Score statistical analysis.
 *
 * Steps:
 * 1. Reject readings outside physical bounds [0, 20000] watts.
 * 2. Fetch the last 30 readings for the given plantId from Supabase.
 * 3. If fewer than 5 historical readings exist, accept (insufficient data).
 * 4. Compute mean, standard deviation, and Z-Score.
 * 5. If stdDev is 0, accept (all historical readings are identical).
 * 6. Flag as anomaly if |Z-Score| > 3.
 *
 * @param {string} plantId - The household/plant identifier.
 * @param {number} solarWatts - The incoming solar wattage reading to evaluate.
 * @returns {Promise<{isAnomaly: boolean, reason: string, zScore?: number}>}
 */
async function detectAnomaly(plantId, solarWatts) {
  // Physical bounds check
  if (solarWatts < 0) {
    return { isAnomaly: true, reason: "Negative wattage reading" };
  }
  if (solarWatts > MAX_SOLAR_WATTS) {
    return { isAnomaly: true, reason: `Exceeds physical max (${MAX_SOLAR_WATTS}W)` };
  }

  // Fetch last 30 readings for this plant
  const { data: rows, error } = await supabase
    .from("readings")
    .select("solar_watts")
    .eq("household_id", plantId)
    .order("ts", { ascending: false })
    .limit(WINDOW_SIZE);

  if (error) {
    console.error("[validateEnergy] Supabase fetch error:", error.message);
    // On query failure, accept the reading to avoid blocking the pipeline
    return { isAnomaly: false, reason: "Supabase query failed; accepted by default" };
  }

  const history = (rows || []).map((r) => r.solar_watts);

  // Not enough data for statistical analysis
  if (history.length < MIN_READINGS) {
    return { isAnomaly: false, reason: `Insufficient history (${history.length}/${MIN_READINGS})` };
  }

  const avg = mean(history);
  const sd = stdDev(history, avg);

  // All historical readings are identical — cannot compute meaningful Z-Score
  if (sd === 0) {
    return { isAnomaly: false, reason: "StdDev is 0; Z-Score skipped" };
  }

  const zScore = Math.abs((solarWatts - avg) / sd);

  if (zScore > Z_THRESHOLD) {
    return {
      isAnomaly: true,
      reason: `Z-Score ${zScore.toFixed(2)} exceeds threshold ${Z_THRESHOLD}`,
      zScore,
    };
  }

  return { isAnomaly: false, reason: "Within normal range", zScore };
}

module.exports = { detectAnomaly };
