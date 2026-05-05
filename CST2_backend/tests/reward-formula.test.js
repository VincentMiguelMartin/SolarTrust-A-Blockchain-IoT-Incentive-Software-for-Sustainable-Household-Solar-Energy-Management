// Run with: node tests/reward-formula.test.js
// Hand-calculation sanity checks for the Dynamic Reward Algorithm.
// No DB, no network — pure formula verification.

const {
  computeReward,
  computeWtime,
  computeWnetwork,
  computeWbehavior,
  isPeakHour,
} = require("../services/rewardService");

const results = [];
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function approxEq(a, b, tol = 0.01) {
  return Math.abs(a - b) < tol;
}
function runCheck(num, name, fn) {
  try {
    const detail = fn();
    console.log(`  PASS  TEST ${num} — ${name}${detail ? ` :: ${detail}` : ""}`);
    results.push({ num, name, passed: true });
  } catch (err) {
    console.log(`  FAIL  TEST ${num} — ${name} :: ${err.message}`);
    results.push({ num, name, passed: false });
  }
}

console.log("=== Reward Formula — Hand-Calc Sanity Checks ===\n");

// ---- W_time ----
runCheck(1, "Peak hour 07:00 → Wt=1.5", () => {
  const ts = "2026-04-15T07:00:00.000Z";
  const local = new Date(ts).getHours();
  // Note: this depends on server TZ. Use a concrete local-time string instead:
  const wt = computeWtime("2026-04-15T07:30:00");
  assert(wt === 1.5, `Expected 1.5, got ${wt}`);
  return `local hour=${new Date("2026-04-15T07:30:00").getHours()}`;
});

runCheck(2, "Off-peak hour 14:00 → Wt=0.8", () => {
  const wt = computeWtime("2026-04-15T14:00:00");
  assert(wt === 0.8, `Expected 0.8, got ${wt}`);
});

runCheck(3, "Peak evening 19:00 → Wt=1.5", () => {
  const wt = computeWtime("2026-04-15T19:00:00");
  assert(wt === 1.5, `Expected 1.5, got ${wt}`);
});

runCheck(4, "Boundary 21:00 (exclusive) → Wt=0.8", () => {
  const wt = computeWtime("2026-04-15T21:00:00");
  assert(wt === 0.8, `Expected 0.8, got ${wt}`);
});

// ---- W_network ----
runCheck(5, "Wn: low load (demand=2, cap=10) → 0.8", () => {
  const wn = computeWnetwork(2, 10);
  assert(approxEq(wn, 0.8), `Expected 0.8, got ${wn}`);
});

runCheck(6, "Wn: clamp upper bound (demand=0, cap=10) → 1.0 (1−0=1, in range)", () => {
  const wn = computeWnetwork(0, 10);
  assert(wn === 1.0, `Expected 1.0, got ${wn}`);
});

runCheck(7, "Wn: high load clamps to 0.5 (demand=10, cap=10)", () => {
  const wn = computeWnetwork(10, 10);
  assert(wn === 0.5, `Expected 0.5, got ${wn}`);
});

// ---- W_behavior ----
runCheck(8, "Wb: null baseline → 1.0", () => {
  const wb = computeWbehavior(5, null);
  assert(wb === 1.0, `Expected 1.0, got ${wb}`);
});

runCheck(9, "Wb: 10% above baseline (saved=11, base=10) → 1.02", () => {
  const wb = computeWbehavior(11, 10);
  assert(approxEq(wb, 1.02), `Expected 1.02, got ${wb}`);
});

runCheck(10, "Wb: clamp ceiling — 4× baseline saturates at 1.5", () => {
  // raw = 1 + 0.2 × ((40-10)/10) = 1 + 0.6 = 1.6 → clamped to 1.5
  const wb = computeWbehavior(40, 10);
  assert(wb === 1.5, `Expected 1.5, got ${wb}`);
});

runCheck(11, "Wb: 50% below baseline → 0.9 (within range, not clamped)", () => {
  // raw = 1 + 0.2 × ((5-10)/10) = 1 - 0.1 = 0.9
  // Note: with 0.2 coefficient and non-negative savings, the 0.5 floor is
  // unreachable in practice — saved=0 yields Wb=0.8.
  const wb = computeWbehavior(5, 10);
  assert(approxEq(wb, 0.9), `Expected 0.9, got ${wb}`);
});

// ---- Full formula ----
runCheck(12, "Full: peak + 10% above baseline + low load", () => {
  // E_v = 5 kWh, baseline = 4.5 kWh → Wb = 1 + 0.2*((5-4.5)/4.5) ≈ 1.0222
  // Wt = 1.5 (07:00), Wn = 0.8 (demand=2,cap=10)
  // R = 10 × 5 × 1.5 × 0.8 × 1.0222 ≈ 61.33
  const { reward, breakdown } = computeReward({
    energySavedKwh: 5,
    baselineKwh: 4.5,
    networkDemandKw: 2,
    networkCapacityKw: 10,
    timestamp: "2026-04-15T07:30:00",
  });
  assert(
    approxEq(reward, 61.33, 0.05),
    `Expected ~61.33, got ${reward} (Wt=${breakdown.Wt}, Wn=${breakdown.Wn}, Wb=${breakdown.Wb})`
  );
  return `reward=${reward}`;
});

runCheck(13, "Full: off-peak + new user (no baseline) + balanced grid", () => {
  // R = 10 × 3 × 0.8 × 1.0 × 1.0 = 24
  const { reward } = computeReward({
    energySavedKwh: 3,
    baselineKwh: null,
    networkDemandKw: 0,
    networkCapacityKw: 10,
    timestamp: "2026-04-15T14:00:00",
  });
  assert(approxEq(reward, 24), `Expected 24, got ${reward}`);
  return `reward=${reward}`;
});

runCheck(14, "Full: zero energy → zero reward", () => {
  const { reward } = computeReward({
    energySavedKwh: 0,
    baselineKwh: 5,
    networkDemandKw: 5,
    networkCapacityKw: 10,
    timestamp: "2026-04-15T19:00:00",
  });
  assert(reward === 0, `Expected 0, got ${reward}`);
});

const passed = results.filter((r) => r.passed).length;
console.log(`\n=== Summary: ${passed}/${results.length} passed ===`);
process.exit(passed === results.length ? 0 : 1);