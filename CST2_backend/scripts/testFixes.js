// Run with: node scripts/testFixes.js
//
// End-to-end demo / test cases for the SolarTrust backend fixes:
//   FIX 1 — Anomaly detection wired into the Taneko cron pipeline
//   FIX 2 — T1/T2 IoT ingestion latency logging in blockchainRecordService
//   FIX 3 — /energy routes mount + /game/session + /dashboard/:userId
//
// The script runs unit-style tests against internal modules AND HTTP tests
// against a running server (default http://localhost:3000).
// Start the server in another terminal first:  npm start
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const { detectAnomaly } = require("../middleware/validateEnergy");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const TEST_PLANT_ID = process.env.TEST_PLANT_ID || "TTC60011";
const TEST_HOUSEHOLD_ID = process.env.TEST_HOUSEHOLD_ID || TEST_PLANT_ID;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const results = [];

async function runCheck(num, name, fn) {
  const label = `TEST ${num}`;
  try {
    const detail = await fn();
    console.log(`\n  ${label} -- ${name}`);
    console.log(`  Result: PASS ${detail || ""}`);
    results.push({ num, name, passed: true });
  } catch (err) {
    console.log(`\n  ${label} -- ${name}`);
    console.log(`  Result: FAIL ${err.message}`);
    results.push({ num, name, passed: false, error: err.message });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function httpJson(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, body: json };
}

// ──────────────────────────────────────────────
// FIX 1 — Anomaly Detection
// ──────────────────────────────────────────────

async function testAnomalyNegative() {
  const result = await detectAnomaly(TEST_PLANT_ID, -50);
  assert(result.isAnomaly === true, "Expected negative wattage to be flagged");
  assert(/Negative/i.test(result.reason), `Unexpected reason: ${result.reason}`);
  return `flagged negative reading → "${result.reason}"`;
}

async function testAnomalyExceedsMax() {
  const result = await detectAnomaly(TEST_PLANT_ID, 99999);
  assert(result.isAnomaly === true, "Expected >20000W to be flagged");
  assert(/physical max/i.test(result.reason), `Unexpected reason: ${result.reason}`);
  return `flagged 99999W → "${result.reason}"`;
}

async function testAnomalyWithinRange() {
  const result = await detectAnomaly(TEST_PLANT_ID, 500);
  assert(result.isAnomaly === false, `Expected 500W to be accepted, got: ${result.reason}`);
  return `accepted 500W → "${result.reason}"${result.zScore !== undefined ? `, zScore=${result.zScore.toFixed(2)}` : ""}`;
}

async function testAnomalyLogInsert() {
  // Simulate what tanekoCron does on anomaly: insert to anomaly_logs
  const row = {
    plant_id: TEST_PLANT_ID,
    solar_watts: -1,
    reason: "TEST: Negative wattage reading",
    z_score: null,
    detected_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("anomaly_logs")
    .insert([row])
    .select()
    .single();
  if (error) throw new Error(`anomaly_logs insert failed: ${error.message}`);
  // Clean up the test row
  await supabase.from("anomaly_logs").delete().eq("id", data.id);
  return `inserted + cleaned test row id=${data.id}`;
}

// ──────────────────────────────────────────────
// FIX 2 — T1/T2 Latency
// ──────────────────────────────────────────────

async function testRecordEnergyLatency() {
  // This calls blockchainRecordService.recordEnergyOnChain via HTTP.
  // Watch the server console for:
  //   [blockchainRecordService] T1 payload received: ...
  //   [blockchainRecordService] T2 stored: ...
  //   [blockchainRecordService] IoT Ingestion Latency (T1→T2): <ms>ms
  const t0 = Date.now();
  const { status, body } = await httpJson("POST", "/blockchain/record", {
    plantId: TEST_PLANT_ID,
    solarWatts: 420,
    gridWatts: 10,
    exportWatts: 5,
    ts: new Date().toISOString(),
  });
  const clientLatencyMs = Date.now() - t0;
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
  assert(body.readingId, "Missing readingId in response");
  assert(body.readingHash, "Missing readingHash in response");
  // Clean up the test reading
  await supabase.from("readings").delete().eq("id", body.readingId);
  return `readingId=${body.readingId}, round-trip=${clientLatencyMs}ms (check server logs for T1/T2)`;
}

// ──────────────────────────────────────────────
// FIX 3 — Routes
// ──────────────────────────────────────────────

async function testEnergyRouteMounted() {
  const { status, body } = await httpJson("GET", `/energy/sync/${TEST_PLANT_ID}`);
  // This endpoint hits the Taneko API; any response other than 404 proves the
  // router is mounted. 200 / 400 / 500 / 502 all mean the route exists.
  assert(status !== 404, `/energy route is NOT mounted (404). Body: ${JSON.stringify(body)}`);
  return `/energy/sync/:plantId is mounted (status=${status})`;
}

async function testGameSessionMissingFields() {
  const { status, body } = await httpJson("POST", "/game/session", {
    householdId: TEST_HOUSEHOLD_ID,
    // cleanliness + score intentionally omitted
  });
  assert(status === 400, `Expected 400, got ${status}`);
  assert(body.error, "Expected error message in body");
  return `rejected missing fields with 400 → "${body.error}"`;
}

async function testGameSessionSuccess() {
  const payload = {
    householdId: TEST_HOUSEHOLD_ID,
    cleanliness: 87,
    score: 1250,
  };
  const { status, body } = await httpJson("POST", "/game/session", payload);
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
  assert(body.success === true, "Expected success=true");
  assert(body.message === "Game session recorded", `Unexpected message: ${body.message}`);
  assert(body.householdId === payload.householdId, "householdId mismatch");
  assert(body.score === payload.score, "score mismatch");
  assert(body.cleanliness === payload.cleanliness, "cleanliness mismatch");
  assert(body.completedAt, "Missing completedAt");
  return `recorded session for ${payload.householdId} score=${payload.score} cleanliness=${payload.cleanliness}%`;
}

async function testDashboardReturnsStats() {
  const { status, body } = await httpJson("GET", `/dashboard/${encodeURIComponent(TEST_HOUSEHOLD_ID)}`);
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
  assert(body.userId === TEST_HOUSEHOLD_ID, "userId mismatch");
  assert(typeof body.totalVerifiedEnergyWatts === "number", "totalVerifiedEnergyWatts must be a number");
  assert(typeof body.totalConfirmedReadings === "number", "totalConfirmedReadings must be a number");
  assert(typeof body.totalGameSessions === "number", "totalGameSessions must be a number");
  assert(typeof body.rewardPoints === "number", "rewardPoints must be a number");
  assert(Number.isFinite(body.rewardPoints), "rewardPoints must be finite");
  assert(body.rewardPoints >= 0, "rewardPoints must be non-negative");
  return `energy=${body.totalVerifiedEnergyWatts}W, readings=${body.totalConfirmedReadings}, games=${body.totalGameSessions}, points=${body.rewardPoints}`;
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" SolarTrust Backend — Fix Verification Tests");
  console.log(`  Base URL:     ${BASE_URL}`);
  console.log(`  Plant ID:     ${TEST_PLANT_ID}`);
  console.log(`  Household ID: ${TEST_HOUSEHOLD_ID}`);
  console.log("═══════════════════════════════════════════════════════════");

  console.log("\n── FIX 1: Anomaly Detection ──");
  await runCheck(1, "detectAnomaly flags negative wattage", testAnomalyNegative);
  await runCheck(2, "detectAnomaly flags readings > 20000W", testAnomalyExceedsMax);
  await runCheck(3, "detectAnomaly accepts normal wattage", testAnomalyWithinRange);
  await runCheck(4, "anomaly_logs table is writable from the cron pipeline", testAnomalyLogInsert);

  console.log("\n── FIX 2: IoT Ingestion Latency (T1→T2) ──");
  await runCheck(5, "recordEnergyOnChain logs T1/T2 latency", testRecordEnergyLatency);

  console.log("\n── FIX 3: Route Wiring ──");
  await runCheck(6, "energyRoutes mounted at /energy", testEnergyRouteMounted);
  await runCheck(7, "POST /game/session rejects missing fields (400)", testGameSessionMissingFields);
  await runCheck(8, "POST /game/session records a valid session (200)", testGameSessionSuccess);
  await runCheck(9, "GET /dashboard/:userId returns energy + game stats", testDashboardReturnsStats);

  // ── Summary ──
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(` SUMMARY:  ${passed} passed,  ${failed} failed,  ${results.length} total`);
  console.log("═══════════════════════════════════════════════════════════");

  if (failed > 0) {
    console.log("\nFailures:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  - TEST ${r.num} ${r.name}: ${r.error}`);
    });
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
