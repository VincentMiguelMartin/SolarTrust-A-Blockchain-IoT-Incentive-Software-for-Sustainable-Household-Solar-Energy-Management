const request = require("supertest");

const BASE_URL = process.env.BLACKBOX_BASE_URL || "http://127.0.0.1:3000";
const LIVE_BASE_URL = process.env.BLACKBOX_LIVE_BASE_URL || process.env.RENDER_BACKEND_URL;
const TEST_HOUSEHOLD_ID = process.env.BLACKBOX_TEST_HOUSEHOLD_ID || "blackbox-household-001";
const TEST_PLANT_ID = process.env.BLACKBOX_TEST_PLANT_ID || process.env.TANEKO_PLANT_ID || "TTC60011";
// Aligns with validateEnergy.MAX_SOLAR_WATTS (the real physical-bounds constant
// used by the Taneko ingestion cron). Not enforced on the HTTP /readings route.
const MAX_CAPACITY_WATTS = Number(process.env.BLACKBOX_MAX_CAPACITY_WATTS || 20000);
const MAX_DRIFT_MS = Number(process.env.BLACKBOX_MAX_DRIFT_MS || 5 * 60 * 1000);

function api(baseUrl = BASE_URL) {
  return request(baseUrl);
}

function timed(label) {
  const start = Date.now();
  return {
    start,
    mark() {
      const end = Date.now();
      return {
        label,
        startedAt: new Date(start).toISOString(),
        endedAt: new Date(end).toISOString(),
        latencyMs: end - start,
      };
    },
  };
}

module.exports = {
  api,
  BASE_URL,
  LIVE_BASE_URL,
  TEST_HOUSEHOLD_ID,
  TEST_PLANT_ID,
  MAX_CAPACITY_WATTS,
  MAX_DRIFT_MS,
  timed,
};
