/**
 * Converts a series of instantaneous solar power readings (watts)
 * into total energy (kWh) using the trapezoidal rule:
 *
 *   E = Σ ((P_i + P_{i+1}) / 2) × Δt_i
 *
 * The trapezoidal rule handles uneven sampling intervals correctly,
 * which matters because the Taneko cron may occasionally miss fetches.
 *
 * @param {Array<{solar_watts: number, ts: string}>} readings
 * @returns {number} energy in kWh
 */
function readingsToKwh(readings) {
  if (!readings || readings.length === 0) return 0;

  if (readings.length === 1) {
    // Single reading: assume one default 15-minute interval
    return (Number(readings[0].solar_watts || 0) * 0.25) / 1000;
  }

  const sorted = [...readings].sort(
    (a, b) => new Date(a.ts) - new Date(b.ts)
  );

  let wattHours = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const dtHours =
      (new Date(sorted[i + 1].ts) - new Date(sorted[i].ts)) / 3600000;
    const avgWatts =
      (Number(sorted[i].solar_watts || 0) +
        Number(sorted[i + 1].solar_watts || 0)) /
      2;
    wattHours += avgWatts * dtHours;
  }

  return wattHours / 1000;
}

module.exports = { readingsToKwh };