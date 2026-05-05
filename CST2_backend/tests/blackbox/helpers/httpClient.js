const request = require("supertest");

const BASE_URL = process.env.BLACKBOX_BASE_URL || "http://127.0.0.1:3000";
const LIVE_BASE_URL = process.env.BLACKBOX_LIVE_BASE_URL || process.env.RENDER_BACKEND_URL;
const TEST_HOUSEHOLD_ID = process.env.BLACKBOX_TEST_HOUSEHOLD_ID || "blackbox-household-001";
const TEST_PLANT_ID = process.env.BLACKBOX_TEST_PLANT_ID || process.env.TANEKO_PLANT_ID || "TTC60011";
const MAX_CAPACITY_WATTS = Number(process.env.BLACKBOX_MAX_CAPACITY_WATTS || 10000);
const MAX_DRIFT_MS = Number(process.env.BLACKBOX_MAX_DRIFT_MS || 5 * 60 * 1000);

function api(baseUrl = BASE_URL) {
  return request(baseUrl);
}

function timed(label) {
  const t1 = Date.now();
  return {
    t1,
    mark(requestStartedAt = Date.now()) {
      const t2 = requestStartedAt;
      const t3 = Date.now();
      const t4 = Date.now();
      return {
        label,
        T1: new Date(t1).toISOString(),
        T2: new Date(t2).toISOString(),
        T3: new Date(t3).toISOString(),
        T4: new Date(t4).toISOString(),
        latencyMs: t4 - t1,
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
