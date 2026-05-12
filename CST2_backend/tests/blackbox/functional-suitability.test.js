/**
 * ISO/IEC 25010 quality characteristic: Functional suitability.
 * Thesis traceability: Chapter 3.7.1 Black Box Testing Methodology.
 * TAM relevance: Perceived usefulness is supported when energy, reward,
 * game, Merkle, and balance workflows produce correct observable outputs.
 */

const { api, TEST_HOUSEHOLD_ID, TEST_PLANT_ID } = require("./helpers/httpClient");

describe("Functional suitability black box tests", () => {
  test("TC-FS-01: valid energy reading submission returns success and reading row", async () => {
    const payload = {
      householdId: TEST_HOUSEHOLD_ID,
      ts: new Date().toISOString(),
      solarWatts: 1250,
      gridWatts: 220,
    };

    const res = await api().post("/readings").send(payload);

    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty("reading");
    expect(res.body.reading.household_id).toBe(TEST_HOUSEHOLD_ID);
    expect(Number(res.body.reading.solar_watts)).toBe(payload.solarWatts);
    // /readings POST does not set blockchain_status — only /blockchain/record does.
    // Treat null/undefined as the expected default for an HTTP-inserted reading.
    expect([null, undefined, "pending", "PENDING"]).toContain(
      res.body.reading.blockchain_status
    );
  });

  test("TC-FS-02: reward computation matches documented formula R = 10·kWh·Wt·Wn·Wb", async () => {
    const energySavedKwh = 10;
    const networkDemandKw = 20;
    const networkCapacityKw = 100;
    const res = await api().post("/api/rewards/calculate").send({
      householdId: TEST_HOUSEHOLD_ID,
      batchId: "bb-known-reward",
      energySavedKwh,
      timestamp: "2026-05-05T18:30:00.000Z",
      networkDemandKw,
      networkCapacityKw,
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body.reward).toHaveProperty("reward_points");

    const { Wt, Wn, Wb } = res.body.breakdown;
    // Range invariants from rewardService.js
    expect([0.8, 1.5]).toContain(Wt);
    expect(Wn).toBeGreaterThanOrEqual(0.5);
    expect(Wn).toBeLessThanOrEqual(1.5);
    expect(Wb).toBeGreaterThanOrEqual(0.5);
    expect(Wb).toBeLessThanOrEqual(1.5);

    // Wn for D=20, C=100 is 1 - 0.2 = 0.8 (within clamp range, no clamping)
    expect(Wn).toBeCloseTo(0.8, 5);

    // R = K · kWh · Wt · Wn · Wb, K = 10, rounded to 2 decimals
    const expectedReward = Math.round(10 * energySavedKwh * Wt * Wn * Wb * 100) / 100;
    expect(Number(res.body.reward.reward_points)).toBeCloseTo(expectedReward, 2);
  });

  test("TC-FS-03: /blockchain/batch returns either no-pending message or a 64-hex Merkle root", async () => {
    const res = await api().post("/blockchain/batch").send({ plantId: TEST_PLANT_ID });

    expect([200, 201]).toContain(res.status);
    if (res.body.message) {
      expect(res.body.message).toMatch(/no pending|empty|no readings/i);
      return;
    }
    // Server returns { merkleRoot, txHash, confirmed, batchSize, reward }
    expect(res.body.merkleRoot).toEqual(expect.any(String));
    expect(res.body.merkleRoot).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.confirmed).toBe(true);
    expect(Number(res.body.batchSize)).toBeGreaterThan(0);
  });

  test("TC-FS-04: /game/session records a session and echoes inputs", async () => {
    const res = await api().post("/game/session").send({
      householdId: TEST_HOUSEHOLD_ID,
      score: 900,
      cleanliness: 95,
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body.householdId).toBe(TEST_HOUSEHOLD_ID);
    expect(Number(res.body.score)).toBe(900);
    expect(Number(res.body.cleanliness)).toBe(95);
    expect(res.body.completedAt).toEqual(expect.any(String));
    // Note: game sessions do NOT directly mint reward points in this build.
    // Reward points are only computed after a confirmed blockchain batch.
  });

  // /api/rewards/:householdId is now bearer-token protected (see
  // routes/rewardRoutes.js requireBearerUser). Functional-suitability of the
  // response body shape is covered through the live e2e suite when a valid
  // Supabase JWT is available; the protection itself is asserted in TC-SEC-01.
  test.skip("TC-FS-05: /api/rewards/:householdId returns accumulated balance contract (REQUIRES VALID JWT)", () => {});

  test("TC-FS-06: /readings rejects a Z-score anomaly once enough history exists", async () => {
    // Seed five identical baseline readings so the household has a known mean
    // and a non-zero stddev only after we send a wildly different value.
    const household = `bbx-anomaly-${Date.now()}`;
    // Spread six seeds within the last 3 minutes so all fall inside the
    // server-enforced MAX_TS_DRIFT_MS window of 5 minutes.
    const baseTs = Date.now() - 3 * 60 * 1000;
    for (let i = 0; i < 6; i += 1) {
      await api().post("/readings").send({
        householdId: household,
        ts: new Date(baseTs + i * 25 * 1000).toISOString(),
        solarWatts: 3000 + i * 20,
        gridWatts: 0,
      });
    }
    // Now send a far-outlier reading (~20 sigma) — must be rejected.
    const res = await api().post("/readings").send({
      householdId: household,
      ts: new Date().toISOString(),
      solarWatts: 18000,
      gridWatts: 0,
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/z-score|anomaly|exceeds/i);
  });

  test("TC-FS-07: /readings accepts a reading within normal range", async () => {
    const res = await api().post("/readings").send({
      householdId: `bbx-normal-${Date.now()}`,
      ts: new Date().toISOString(),
      solarWatts: 2500,
      gridWatts: 100,
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty("reading");
  });
});
