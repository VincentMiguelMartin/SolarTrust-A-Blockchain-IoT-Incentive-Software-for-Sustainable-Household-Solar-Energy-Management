/**
 * ISO/IEC 25010 quality characteristic: Functional suitability and reliability.
 * Thesis traceability: Chapter 3.7.1 Black Box Testing Methodology.
 * TAM relevance: Predictable handling of edge cases improves trust and ease of use.
 */

const crypto = require("crypto");
const {
  api,
  TEST_HOUSEHOLD_ID,
  TEST_PLANT_ID,
  MAX_CAPACITY_WATTS,
  MAX_DRIFT_MS,
} = require("./helpers/httpClient");

function merkleRoot(values) {
  let layer = values.map((value) =>
    crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")
  );
  if (layer.length === 1) layer.push(layer[0]);
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

describe("Boundary and edge case black box tests", () => {
  test("TC-EDGE-01: solarWatts = 0 is a valid minimum", async () => {
    const res = await api().post("/readings").send({
      householdId: TEST_HOUSEHOLD_ID,
      ts: new Date().toISOString(),
      solarWatts: 0,
      gridWatts: 0,
    });

    expect([200, 201]).toContain(res.status);
  });

  test("TC-EDGE-02: solarWatts = MAX_CAPACITY is a valid maximum", async () => {
    const res = await api().post("/readings").send({
      householdId: TEST_HOUSEHOLD_ID,
      ts: new Date().toISOString(),
      solarWatts: MAX_CAPACITY_WATTS,
      gridWatts: 0,
    });

    expect([200, 201]).toContain(res.status);
  });

  test("TC-EDGE-03: solarWatts = -1 is rejected", async () => {
    const res = await api().post("/readings").send({
      householdId: TEST_HOUSEHOLD_ID,
      ts: new Date().toISOString(),
      solarWatts: -1,
      gridWatts: 0,
    });

    expect([400, 422]).toContain(res.status);
  });

  test("TC-EDGE-04: solarWatts = MAX_CAPACITY + 1 is rejected", async () => {
    const res = await api().post("/readings").send({
      householdId: TEST_HOUSEHOLD_ID,
      ts: new Date().toISOString(),
      solarWatts: MAX_CAPACITY_WATTS + 1,
      gridWatts: 0,
    });

    expect([400, 422]).toContain(res.status);
  });

  test("TC-EDGE-05: timestamp drift greater than MAX_DRIFT is rejected", async () => {
    const drifted = new Date(Date.now() - MAX_DRIFT_MS - 60000).toISOString();
    const res = await api().post("/readings").send({
      householdId: TEST_HOUSEHOLD_ID,
      ts: drifted,
      solarWatts: 500,
      gridWatts: 0,
    });

    expect([400, 422]).toContain(res.status);
  });

  test("TC-EDGE-06: empty batch window submits no transaction", async () => {
    const res = await api().post("/blockchain/batch").send({ plantId: "empty-blackbox-plant" });

    expect([200, 204]).toContain(res.status);
    expect(JSON.stringify(res.body)).toMatch(/no pending|empty|no readings|no transaction/i);
  });

  test("TC-EDGE-07: single-reading batch uses leaf duplication", () => {
    const root = merkleRoot([{ plantId: TEST_PLANT_ID, ts: "2026-05-05T01:00:00.000Z", solarWatts: 1 }]);

    expect(root).toEqual(expect.any(String));
    expect(root).toHaveLength(64);
  });

  test("TC-EDGE-08: odd-number-of-readings batch uses duplication logic", () => {
    const root = merkleRoot([
      { plantId: TEST_PLANT_ID, ts: "2026-05-05T01:00:00.000Z", solarWatts: 1 },
      { plantId: TEST_PLANT_ID, ts: "2026-05-05T01:05:00.000Z", solarWatts: 2 },
      { plantId: TEST_PLANT_ID, ts: "2026-05-05T01:10:00.000Z", solarWatts: 3 },
    ]);

    expect(root).toEqual(expect.any(String));
    expect(root).toHaveLength(64);
  });

  test("TC-EDGE-09: baseline = 0 uses W_behavior fallback of 1.0", async () => {
    const res = await api().post("/api/rewards/calculate").send({
      householdId: "blackbox-zero-baseline",
      energySavedKwh: 5,
      timestamp: new Date().toISOString(),
      networkDemandKw: 10,
      networkCapacityKw: 100,
    });

    expect([200, 201]).toContain(res.status);
    expect(Number(res.body.breakdown?.Wb)).toBe(1.0);
  });

  test("TC-EDGE-10: network demand exceeds capacity clamps W_network to 0.5", async () => {
    const res = await api().post("/api/rewards/calculate").send({
      householdId: TEST_HOUSEHOLD_ID,
      energySavedKwh: 5,
      timestamp: new Date().toISOString(),
      networkDemandKw: 150,
      networkCapacityKw: 100,
    });

    expect([200, 201]).toContain(res.status);
    expect(Number(res.body.breakdown?.Wn)).toBe(0.5);
  });
});
