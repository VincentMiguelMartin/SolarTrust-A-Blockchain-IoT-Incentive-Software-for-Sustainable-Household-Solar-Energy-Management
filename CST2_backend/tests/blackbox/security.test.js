/**
 * ISO/IEC 25010 quality characteristic: Security.
 * Thesis traceability: Chapter 3.7.1 Black Box Testing Methodology.
 * TAM relevance: Trust and perceived usefulness require protected reward,
 * authentication, blockchain integrity, and secret-handling behavior.
 */

const { api, TEST_HOUSEHOLD_ID, TEST_PLANT_ID } = require("./helpers/httpClient");

describe("Security black box tests", () => {
  test("TC-SEC-01: unauthenticated request to /api/rewards/:id returns 401", async () => {
    const res = await api().get(`/api/rewards/${encodeURIComponent(TEST_HOUSEHOLD_ID)}`);
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toMatch(/missing|token/i);
  });

  test("TC-SEC-03: tampered bearer token returns 403", async () => {
    const tamperedJwt = "eyJhbGciOiJIUzI1NiJ9.tampered-payload.tampered-signature";
    const res = await api()
      .get(`/api/rewards/${encodeURIComponent(TEST_HOUSEHOLD_ID)}`)
      .set("Authorization", `Bearer ${tamperedJwt}`);
    expect(res.status).toBe(403);
  });

  // Login is delegated to Supabase Auth from the React Native client; the
  // backend does not expose its own /auth/login route. Rate limiting is a
  // Supabase platform control. This case is documented as scoped-out rather
  // than a defect.
  test.skip("TC-SEC-05: rate limiting on /auth/login (SCOPED OUT — login is delegated to Supabase Auth)", () => {});

  test("TC-SEC-02: SQL-injection-shaped userId does not leak schema and is parameterized safely", async () => {
    // Routes that touch the DB go through Supabase's typed client, which
    // parameterizes queries — injection should be a no-op or yield empty data,
    // never a SQL error or schema disclosure.
    const payload = `${TEST_HOUSEHOLD_ID}' OR '1'='1`;
    const res = await api().get(`/dashboard/${encodeURIComponent(payload)}`);

    expect([200, 400, 404, 422, 500]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toMatch(/syntax error|relation .* does not exist|select \*|pg_/i);
    expect(JSON.stringify(res.body)).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|BLOCKFROST_PROJECT_ID|WALLET_SEED_PHRASE/i);
  });

  // /blockchain/record's payload contract is { plantId, solarWatts, gridWatts,
  // exportWatts, ts } — there is no client-supplied merkleRoot. The Merkle
  // root is built server-side from confirmed readings in /blockchain/batch.
  // Tampering tests belong at the verifyReading() unit boundary in merkleService.
  test.skip("TC-SEC-04: tampered Merkle root is rejected (MERKLE ROOT IS NOT A CLIENT INPUT)", () => {});

  test("TC-SEC-06: validation error for /blockchain/record does not leak environment secrets", async () => {
    const res = await api().post("/blockchain/record").send({
      plantId: TEST_PLANT_ID,
      solarWatts: null,
      gridWatts: null,
      exportWatts: null,
      ts: null,
    });

    const text = JSON.stringify(res.body);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(text).not.toMatch(
      /SUPABASE_SERVICE_ROLE_KEY|BLOCKFROST_PROJECT_ID|TANEKO_API_KEY|WALLET_SEED_PHRASE|CARDANO_WALLET_ADDRESS/i
    );
    // Reject anything shaped like a JWT (header.payload.signature) appearing in error bodies
    expect(text).not.toMatch(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
  });
});
