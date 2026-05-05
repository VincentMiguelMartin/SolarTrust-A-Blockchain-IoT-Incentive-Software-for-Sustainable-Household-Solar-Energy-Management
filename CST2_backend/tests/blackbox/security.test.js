/**
 * ISO/IEC 25010 quality characteristic: Security.
 * Thesis traceability: Chapter 3.7.1 Black Box Testing Methodology.
 * TAM relevance: Trust and perceived usefulness require protected reward,
 * authentication, blockchain integrity, and secret-handling behavior.
 */

const { api, TEST_HOUSEHOLD_ID, TEST_PLANT_ID } = require("./helpers/httpClient");

describe("Security black box tests", () => {
  test("TC-SEC-01: unauthenticated request to /rewards/:userId returns 401", async () => {
    const res = await api().get(`/rewards/${encodeURIComponent(TEST_HOUSEHOLD_ID)}`);

    expect(res.status).toBe(401);
  });

  test("TC-SEC-02: SQL injection payload in plantId is sanitized or rejected", async () => {
    const payload = `${TEST_PLANT_ID}' OR '1'='1`;
    const res = await api().get(`/energy/sync/${encodeURIComponent(payload)}`);

    expect([400, 401, 403, 404, 422]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toMatch(/households|readings|supabase|select \*/i);
  });

  test("TC-SEC-03: tampered JWT token returns 403", async () => {
    const res = await api()
      .get(`/api/rewards/${encodeURIComponent(TEST_HOUSEHOLD_ID)}`)
      .set("Authorization", "Bearer header.tampered.signature");

    expect(res.status).toBe(403);
  });

  test("TC-SEC-04: modified reading after Merkle commitment causes root mismatch detection", async () => {
    const res = await api().post("/blockchain/record").send({
      plantId: TEST_PLANT_ID,
      solarWatts: 1234,
      gridWatts: 100,
      exportWatts: 10,
      ts: "2026-05-05T09:00:00.000Z",
      merkleRoot: "tampered-root",
    });

    expect([400, 409, 422]).toContain(res.status);
    expect(JSON.stringify(res.body)).toMatch(/tamper|mismatch|merkle|integrity|invalid/i);
  });

  test("TC-SEC-05: rate limiting prevents brute force on /auth/login", async () => {
    const statuses = [];
    for (let i = 0; i < 12; i += 1) {
      const res = await api().post("/auth/login").send({
        email: "blackbox@example.invalid",
        password: `wrong-password-${i}`,
      });
      statuses.push(res.status);
    }

    expect(statuses).toContain(429);
  });

  test("TC-SEC-06: environment secrets are not exposed in error responses", async () => {
    const res = await api().post("/blockchain/record").send({
      plantId: TEST_PLANT_ID,
      solarWatts: null,
      gridWatts: null,
      exportWatts: null,
      ts: null,
    });

    const text = JSON.stringify(res.body);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(text).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|BLOCKFROST_PROJECT_ID|TANEKO_API_KEY|WALLET_SEED_PHRASE/i);
    expect(text).not.toMatch(/[a-zA-Z0-9_]{32,}\.[a-zA-Z0-9_]{16,}\.[a-zA-Z0-9_]{16,}/);
  });
});
