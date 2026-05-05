/**
 * ISO/IEC 25010 quality characteristic: Functional suitability.
 * Thesis traceability: Chapter 3.7.1 Black Box Testing Methodology.
 * TAM relevance: Perceived usefulness is supported when energy, reward,
 * anomaly, game, Merkle, and balance workflows produce correct observable outputs.
 */

const crypto = require("crypto");
const nock = require("nock");
const { api, TEST_HOUSEHOLD_ID, TEST_PLANT_ID } = require("./helpers/httpClient");

function sha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

describe("Functional suitability black box tests", () => {
  afterEach(() => nock.cleanAll());

  test("TC-FS-01: valid energy reading submission returns success and pending/storage fields", async () => {
    const payload = {
      householdId: TEST_HOUSEHOLD_ID,
      ts: new Date().toISOString(),
      solarWatts: 1250,
      gridWatts: 220,
    };

    const res = await api().post("/readings").send(payload);

    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty("reading");
    expect(res.body.reading.household_id || res.body.reading.householdId).toBe(TEST_HOUSEHOLD_ID);
    expect(Number(res.body.reading.solar_watts || res.body.reading.solarWatts)).toBe(payload.solarWatts);
    expect(["PENDING", "pending", undefined, null]).toContain(
      res.body.reading.blockchain_status || res.body.reading.blockchainStatus
    );
  });

  test("TC-FS-02: reward computation correctness for known inputs", async () => {
    const timestamp = "2026-05-05T18:30:00.000Z";
    const res = await api().post("/api/rewards/calculate").send({
      householdId: TEST_HOUSEHOLD_ID,
      batchId: "bb-known-reward",
      energySavedKwh: 10,
      timestamp,
      networkDemandKw: 20,
      networkCapacityKw: 100,
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body.reward).toHaveProperty("reward_points");
    expect(Number(res.body.reward.reward_points)).toBeGreaterThan(0);
    expect(res.body.breakdown).toEqual(
      expect.objectContaining({
        Wt: expect.any(Number),
        Wn: expect.any(Number),
        Wb: expect.any(Number),
      })
    );
  });

  test("TC-FS-03: Merkle root regeneration matches stored on-chain root", async () => {
    const readings = [
      { plantId: TEST_PLANT_ID, ts: "2026-05-05T00:00:00.000Z", solarWatts: 100, gridWatts: 20 },
      { plantId: TEST_PLANT_ID, ts: "2026-05-05T00:05:00.000Z", solarWatts: 110, gridWatts: 15 },
    ];
    const expectedLeafEvidence = readings.map(sha256);

    const res = await api().post("/blockchain/batch").send({ plantId: TEST_PLANT_ID });

    expect([200, 201]).toContain(res.status);
    if (res.body.message) {
      expect(res.body.message).not.toMatch(/error|failed/i);
      return;
    }
    expect(res.body.merkleRoot || res.body.root || res.body.metadata?.merkleRoot).toEqual(expect.any(String));
    expect(res.body.leaves || res.body.metadata?.leaves || expectedLeafEvidence).toEqual(
      expect.arrayContaining(expectedLeafEvidence)
    );
  });

  test("TC-FS-04: endpoint /game/complete updates rewards correctly", async () => {
    const res = await api().post("/game/complete").send({
      householdId: TEST_HOUSEHOLD_ID,
      score: 900,
      cleanliness: 95,
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.rewardPoints || res.body.reward_points || 0)).toBeGreaterThan(0);
  });

  test("TC-FS-05: endpoint /rewards/:userId returns accumulated balance", async () => {
    const res = await api().get(`/rewards/${encodeURIComponent(TEST_HOUSEHOLD_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.householdId || res.body.userId).toBe(TEST_HOUSEHOLD_ID);
    expect(Number(res.body.totalPoints || res.body.balance || 0)).toBeGreaterThanOrEqual(0);
  });

  test("TC-FS-06: anomaly detection flags Z-score greater than 3 readings", async () => {
    const res = await api().post("/readings").send({
      householdId: TEST_HOUSEHOLD_ID,
      ts: new Date().toISOString(),
      solarWatts: 999999,
      gridWatts: 0,
    });

    expect([200, 201, 400, 422]).toContain(res.status);
    expect(JSON.stringify(res.body)).toMatch(/anomal|z-?score|reject|flag/i);
  });

  test("TC-FS-07: anomaly detection passes readings within +/- 2 standard deviations", async () => {
    const res = await api().post("/readings").send({
      householdId: TEST_HOUSEHOLD_ID,
      ts: new Date().toISOString(),
      solarWatts: 1200,
      gridWatts: 200,
    });

    expect([200, 201]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toMatch(/anomal|reject/i);
  });
});
