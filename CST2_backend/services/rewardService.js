const K_BASE_COEFFICIENT = 10;
function isPeakHour(hour) {
  return (hour >= 6 && hour < 9) || (hour >= 17 && hour < 21);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeWtime(timestamp) {
  const hour = new Date(timestamp).getHours();
  return isPeakHour(hour) ? 1.5 : 0.8;
}

function computeWnetwork(networkDemandKw, networkCapacityKw) {
  if (!networkCapacityKw || networkCapacityKw <= 0) return 1.0;
  const raw = 1 - networkDemandKw / networkCapacityKw;
  return clamp(raw, 0.5, 1.5);
}

function computeWbehavior(energySavedKwh, baselineKwh) {
  if (!baselineKwh || baselineKwh <= 0) return 1.0;
  const raw = 1 + 0.2 * ((energySavedKwh - baselineKwh) / baselineKwh);
  return clamp(raw, 0.5, 1.5);
}

/**
 * @param {object} input
 * @param {number} input.energySavedKwh   Verified kWh for the batch
 * @param {number|null} input.baselineKwh 30-day rolling baseline, or null
 * @param {number} input.networkDemandKw  Current grid demand in kW
 * @param {number} input.networkCapacityKw Total grid capacity in kW
 * @param {string} input.timestamp        ISO 8601 — batch midpoint preferred
 * @returns {{reward: number, breakdown: object}}
 */
function computeReward({
  energySavedKwh,
  baselineKwh,
  networkDemandKw,
  networkCapacityKw,
  timestamp,
}) {
  const Wt = computeWtime(timestamp);
  const Wn = computeWnetwork(networkDemandKw, networkCapacityKw);
  const Wb = computeWbehavior(energySavedKwh, baselineKwh);

  const reward = K_BASE_COEFFICIENT * energySavedKwh * Wt * Wn * Wb;

  return {
    reward: Math.round(reward * 100) / 100,
    breakdown: {
      k: K_BASE_COEFFICIENT,
      energySavedKwh,
      Wt,
      Wn,
      Wb,
      baselineKwh: baselineKwh ?? null,
      networkDemandKw,
      networkCapacityKw,
      timestamp,
    },
  };
}

module.exports = {
  computeReward,
  computeWtime,
  computeWnetwork,
  computeWbehavior,
  isPeakHour,
};