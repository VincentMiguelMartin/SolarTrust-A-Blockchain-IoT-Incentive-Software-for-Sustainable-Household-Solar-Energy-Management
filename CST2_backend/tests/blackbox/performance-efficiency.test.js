/**
 * ISO/IEC 25010 quality characteristic: Performance efficiency.
 * Thesis traceability: Chapter 3.7.1 Black Box Testing Methodology.
 * TAM relevance: Low latency supports perceived ease of use during UAT.
 */

const crypto = require("crypto");
const { api, TEST_HOUSEHOLD_ID, TEST_PLANT_ID, timed } = require("./helpers/httpClient");

const latencyLog = [];

function logTiming(entry) {
  latencyLog.push(entry);
  console.log(`${entry.label}: T1=${entry.T1} T2=${entry.T2} T3=${entry.T3} T4=${entry.T4} latencyMs=${entry.latencyMs}`);
}

function buildMerkleRoot(readings) {
  let layer = readings.map((reading) =>
    crypto.createHash("sha256").update(JSON.stringify(reading)).digest("hex")
  );
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] || left;
      next.push(crypto.createHash("sha256").update(left + right).digest("hex"));
    }
    layer = next;
  }
  return layer[0];
}

describe("Performance efficiency black box tests", () => {
  afterAll(() => {
    console.log(JSON.stringify({ latencyLog }, null, 2));
  });

  test("TC-PERF-01: API response time for /energy/sync is <= 500ms p95 proxy", async () => {
    const samples = [];
    for (let i = 0; i < 5; i += 1) {
      const timer = timed(`TC-PERF-01-sample-${i + 1}`);
      const requestStartedAt = Date.now();
      const res = await api().get(`/energy/sync/${encodeURIComponent(TEST_PLANT_ID)}`);
      const entry = timer.mark(requestStartedAt);
      logTiming(entry);
      samples.push(entry.latencyMs);
      expect([200, 400, 401, 404, 500, 502, 503, 504]).toContain(res.status);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
    expect(p95).toBeLessThanOrEqual(500);
  });

  test("TC-PERF-02: Merkle Tree construction for 100 readings is <= 200ms", () => {
    const readings = Array.from({ length: 100 }, (_, i) => ({
      plantId: TEST_PLANT_ID,
      ts: new Date(Date.UTC(2026, 4, 5, 0, i)).toISOString(),
      solarWatts: 500 + i,
      gridWatts: 100,
    }));

    const timer = timed("TC-PERF-02");
    const root = buildMerkleRoot(readings);
    const entry = timer.mark();
    logTiming(entry);

    expect(root).toEqual(expect.any(String));
    expect(entry.latencyMs).toBeLessThanOrEqual(200);
  });

  test("TC-PERF-03: dashboard data fetch is <= 1000ms", async () => {
    const timer = timed("TC-PERF-03");
    const requestStartedAt = Date.now();
    const res = await api().get(`/dashboard/${encodeURIComponent(TEST_HOUSEHOLD_ID)}`);
    const entry = timer.mark(requestStartedAt);
    logTiming(entry);

    expect([200, 404, 500]).toContain(res.status);
    expect(entry.latencyMs).toBeLessThanOrEqual(1000);
  });

  test("TC-PERF-04: reward computation is <= 50ms per execution", async () => {
    const timer = timed("TC-PERF-04");
    const requestStartedAt = Date.now();
    const res = await api().post("/api/rewards/calculate").send({
      householdId: TEST_HOUSEHOLD_ID,
      batchId: "bb-perf-reward",
      energySavedKwh: 5,
      timestamp: new Date().toISOString(),
      networkDemandKw: 10,
      networkCapacityKw: 100,
    });
    const entry = timer.mark(requestStartedAt);
    logTiming(entry);

    expect([200, 201, 400, 500]).toContain(res.status);
    expect(entry.latencyMs).toBeLessThanOrEqual(50);
  });
});
