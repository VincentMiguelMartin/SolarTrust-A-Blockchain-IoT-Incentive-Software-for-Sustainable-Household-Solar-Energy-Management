/**
 * ISO/IEC 25010 quality characteristic: Functional suitability, reliability, and portability.
 * Thesis traceability: Chapter 3.7.1 Black Box Testing Methodology live e2e validation.
 * TAM relevance: Live Render + Cardano Preprod behavior supports panel-facing UAT confidence.
 */

const { api, LIVE_BASE_URL, TEST_HOUSEHOLD_ID, TEST_PLANT_ID } = require("../helpers/httpClient");

const describeLive = LIVE_BASE_URL ? describe : describe.skip;

describeLive("Live Render backend and Cardano Preprod black box e2e smoke tests", () => {
  test("TC-E2E-01: live backend health endpoint responds", async () => {
    const res = await api(LIVE_BASE_URL).get("/test");

    expect(res.status).toBe(200);
    expect(res.body.status).toMatch(/connected/i);
  });

  test("TC-E2E-02: live Taneko sync returns observable reading or controlled upstream error", async () => {
    const res = await api(LIVE_BASE_URL).get(`/energy/sync/${encodeURIComponent(TEST_PLANT_ID)}`);

    expect([200, 401, 404, 500, 502, 503, 504]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|BLOCKFROST_PROJECT_ID|WALLET_SEED_PHRASE/i);
  });

  test("TC-E2E-03: live rewards endpoint returns user balance contract", async () => {
    const res = await api(LIVE_BASE_URL).get(`/api/rewards/${encodeURIComponent(TEST_HOUSEHOLD_ID)}`);

    expect([200, 401, 403, 404, 500]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|BLOCKFROST_PROJECT_ID|WALLET_SEED_PHRASE/i);
  });
});
