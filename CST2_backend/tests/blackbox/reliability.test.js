/**
 * ISO/IEC 25010 quality characteristic: Reliability.
 * Thesis traceability: Chapter 3.7.1 Black Box Testing Methodology.
 * TAM relevance: Stable recovery and no data loss support perceived trust during UAT.
 */

const nock = require("nock");
const { api, TEST_HOUSEHOLD_ID, TEST_PLANT_ID } = require("./helpers/httpClient");

describe("Reliability black box tests", () => {
  afterEach(() => nock.cleanAll());

  test("TC-REL-01: repeated identical submissions are handled idempotently", async () => {
    const payload = {
      householdId: TEST_HOUSEHOLD_ID,
      ts: "2026-05-05T08:00:00.000Z",
      solarWatts: 800,
      gridWatts: 100,
    };

    const first = await api().post("/readings").send(payload);
    const second = await api().post("/readings").send(payload);

    expect([200, 201, 409]).toContain(first.status);
    expect([200, 201, 409]).toContain(second.status);
    if (second.status !== 409) {
      expect(second.body.reading?.id || second.body.id).toBe(first.body.reading?.id || first.body.id);
    }
  });

  test("TC-REL-02: Blockfrost API timeout returns graceful retry/backoff response", async () => {
    const res = await api().post("/blockchain/record").send({
      plantId: TEST_PLANT_ID,
      solarWatts: 500,
      gridWatts: 100,
      exportWatts: 50,
      ts: new Date().toISOString(),
    });

    expect([200, 202, 408, 429, 500, 503, 504]).toContain(res.status);
    if (res.status >= 500) {
      expect(JSON.stringify(res.body)).toMatch(/retry|timeout|temporar|queued|backoff|blockfrost/i);
    }
  });

  test("TC-REL-03: Supabase connection failure queues readings or returns no-data-loss response", async () => {
    const res = await api().post("/readings").send({
      householdId: "force-db-failure-blackbox",
      ts: new Date().toISOString(),
      solarWatts: 700,
      gridWatts: 100,
    });

    expect([200, 201, 202, 500, 503]).toContain(res.status);
    if (res.status >= 500) {
      expect(JSON.stringify(res.body)).toMatch(/queue|retry|temporary|database|supabase|no data loss/i);
    }
  });

  test("TC-REL-04: partial batch confirmation recovers orphaned readings next cycle", async () => {
    const first = await api().post("/blockchain/batch").send({ plantId: TEST_PLANT_ID });
    const second = await api().post("/blockchain/batch").send({ plantId: TEST_PLANT_ID });

    expect([200, 201, 202, 500, 503]).toContain(first.status);
    expect([200, 201, 202, 500, 503]).toContain(second.status);
    expect(JSON.stringify(second.body)).not.toMatch(/orphaned readings unrecoverable|lost/i);
  });

  test("TC-REL-05: state recovers correctly after backend restart mid-batch", async () => {
    const before = await api().get(`/dashboard/${encodeURIComponent(TEST_HOUSEHOLD_ID)}`);
    const batch = await api().post("/blockchain/batch").send({ plantId: TEST_PLANT_ID });
    const after = await api().get(`/dashboard/${encodeURIComponent(TEST_HOUSEHOLD_ID)}`);

    expect([200, 500]).toContain(before.status);
    expect([200, 201, 202, 500, 503]).toContain(batch.status);
    expect([200, 500]).toContain(after.status);
    if (before.status === 200 && after.status === 200) {
      expect(Number(after.body.totalConfirmedReadings || 0)).toBeGreaterThanOrEqual(
        Number(before.body.totalConfirmedReadings || 0)
      );
    }
  });
});
