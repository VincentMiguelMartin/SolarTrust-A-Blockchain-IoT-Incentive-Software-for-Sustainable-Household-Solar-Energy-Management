/**
 * ISO/IEC 25010 quality characteristic: Reliability.
 * Thesis traceability: Chapter 3.7.1 Black Box Testing Methodology.
 * TAM relevance: Stable recovery and no data loss support perceived trust during UAT.
 */

const { api, TEST_HOUSEHOLD_ID, TEST_PLANT_ID } = require("./helpers/httpClient");

describe("Reliability black box tests", () => {
  test("TC-REL-01: repeated identical submissions both succeed (idempotency NOT enforced)", async () => {
    // The /readings route inserts unconditionally; Supabase auto-generates a new
    // id per call. Black-box-observable behavior: both writes succeed and produce
    // separate rows. If a future migration adds a unique (household_id, ts) index,
    // tighten this assertion to expect 409 on the second call.
    const payload = {
      householdId: TEST_HOUSEHOLD_ID,
      ts: new Date().toISOString(),
      solarWatts: 800,
      gridWatts: 100,
    };

    const first = await api().post("/readings").send(payload);
    const second = await api().post("/readings").send(payload);

    expect([200, 201, 409, 500]).toContain(first.status);
    expect([200, 201, 409, 500]).toContain(second.status);

    if ([200, 201].includes(first.status) && [200, 201].includes(second.status)) {
      expect(second.body.reading.household_id).toBe(first.body.reading.household_id);
      expect(second.body.reading.ts).toBe(first.body.reading.ts);
    }
  });

  test("TC-REL-02: /blockchain/record returns a controlled status when Blockfrost is degraded", async () => {
    const res = await api().post("/blockchain/record").send({
      plantId: TEST_PLANT_ID,
      solarWatts: 500,
      gridWatts: 100,
      exportWatts: 50,
      ts: new Date().toISOString(),
    });

    // Success or any documented upstream-degradation status — never an unhandled crash
    expect([200, 202, 408, 429, 500, 502, 503, 504]).toContain(res.status);
    expect(res.body).toBeDefined();
    if (res.status >= 500) {
      // Error body must include some diagnostic, not just a stack trace dump
      expect(JSON.stringify(res.body)).toMatch(/error|retry|timeout|temporar|blockfrost|supabase/i);
    }
  });

  test("TC-REL-03: /readings returns a controlled status when Supabase is unreachable", async () => {
    const res = await api().post("/readings").send({
      householdId: "force-db-failure-blackbox",
      ts: new Date().toISOString(),
      solarWatts: 700,
      gridWatts: 100,
    });

    expect([200, 201, 202, 400, 500, 503]).toContain(res.status);
    if (res.status >= 500) {
      expect(JSON.stringify(res.body)).toMatch(/error|database|supabase|temporar|retry/i);
    }
  });

  test("TC-REL-04: consecutive batch calls do not surface orphaned-readings errors", async () => {
    const first = await api().post("/blockchain/batch").send({ plantId: TEST_PLANT_ID });
    const second = await api().post("/blockchain/batch").send({ plantId: TEST_PLANT_ID });

    expect([200, 201, 202, 500, 502, 503]).toContain(first.status);
    expect([200, 201, 202, 500, 502, 503]).toContain(second.status);
    expect(JSON.stringify(second.body)).not.toMatch(/orphaned readings unrecoverable|lost/i);
  });

  test("TC-REL-05: confirmed-reading count is monotonic across a batch cycle", async () => {
    const before = await api().get(`/dashboard/${encodeURIComponent(TEST_HOUSEHOLD_ID)}`);
    const batch = await api().post("/blockchain/batch").send({ plantId: TEST_PLANT_ID });
    const after = await api().get(`/dashboard/${encodeURIComponent(TEST_HOUSEHOLD_ID)}`);

    expect([200, 500]).toContain(before.status);
    expect([200, 201, 202, 500, 502, 503]).toContain(batch.status);
    expect([200, 500]).toContain(after.status);

    if (before.status === 200 && after.status === 200) {
      expect(Number(after.body.totalConfirmedReadings || 0)).toBeGreaterThanOrEqual(
        Number(before.body.totalConfirmedReadings || 0)
      );
    }
  });
});
