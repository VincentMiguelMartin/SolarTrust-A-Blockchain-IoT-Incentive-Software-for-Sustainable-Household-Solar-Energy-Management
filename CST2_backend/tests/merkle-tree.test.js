// Run with: node tests/merkle-tree.test.js
//
// Merkle Tree / Cryptographic Batching — Structural Correctness + Tamper Detection
//
// TC-MT-01..TC-MT-09: unit tests for buildMerkleRoot, buildLeafHash.
// Pure computation — no DB or network calls.
//
// Outputs structured JSON to tests/results/merkle-tree_<ts>.json
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { performance } = require("perf_hooks");
const { buildMerkleRoot, buildLeafHash } = require("../services/merkleService");

const RUN_ID = `MERKLE_${Date.now()}`;
const results = [];

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function sha256(s) { return crypto.createHash("sha256").update(s).digest("hex"); }

function runCheck(tcId, name, fn) {
  const t0 = performance.now();
  try {
    const detail = fn();
    const ms = (performance.now() - t0).toFixed(2);
    console.log(`  PASS  ${tcId} — ${name} (${ms}ms)${detail ? ` :: ${detail}` : ""}`);
    results.push({ tcId, name, passed: true, detail: detail || null, durationMs: +ms });
  } catch (err) {
    const ms = (performance.now() - t0).toFixed(2);
    console.log(`  FAIL  ${tcId} — ${name} (${ms}ms) :: ${err.message}`);
    results.push({ tcId, name, passed: false, error: err.message, durationMs: +ms });
  }
}

function writeResults() {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(__dirname, "results");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `merkle-tree_${ts}.json`);
  const passed = results.filter(r => r.passed).length;
  const payload = {
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    testFile: "merkle-tree.test.js",
    results,
    summary: { total: results.length, passed, failed: results.length - passed },
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  console.log(`\n  Results written to ${path.relative(process.cwd(), file)}`);
}

const mkReading = (i) => ({
  plantId: "TEST_PLANT",
  solarWatts: 100 + i,
  gridWatts: 50 + i,
  ts: `2026-04-15T10:00:${String(i).padStart(2, "0")}.000Z`,
});

console.log("=== Merkle Tree — Structural Correctness + Tamper Detection ===");
console.log(`Run ID: ${RUN_ID}\n`);

// TC-MT-01: Single reading → root == SHA-256(leaf)
runCheck("TC-MT-01", "Single reading: root equals leaf hash", () => {
  const r = mkReading(0);
  const root = buildMerkleRoot([r]);
  const expected = buildLeafHash(r.plantId, r.solarWatts, r.gridWatts, r.ts);
  assert(root === expected, `Expected ${expected}, got ${root}`);
  return `root=${root.slice(0, 16)}...`;
});

// TC-MT-02: Two readings → root == SHA-256(leaf1 || leaf2)
runCheck("TC-MT-02", "Two readings: root equals SHA-256(leaf1||leaf2)", () => {
  const readings = [mkReading(0), mkReading(1)];
  const leaves = readings.map(r => buildLeafHash(r.plantId, r.solarWatts, r.gridWatts, r.ts));
  const expected = sha256(leaves[0] + leaves[1]);
  const root = buildMerkleRoot(readings);
  assert(root === expected, `Expected ${expected}, got ${root}`);
  return `root=${root.slice(0, 16)}...`;
});

// TC-MT-03: Odd count (3) — last leaf duplicated for balance
runCheck("TC-MT-03", "Odd count (3): last leaf duplicated, tree balanced", () => {
  const readings = Array.from({ length: 3 }, (_, i) => mkReading(i));
  const leaves = readings.map(r => buildLeafHash(r.plantId, r.solarWatts, r.gridWatts, r.ts));
  const h01 = sha256(leaves[0] + leaves[1]);
  const h22 = sha256(leaves[2] + leaves[2]);
  const expected = sha256(h01 + h22);
  const root = buildMerkleRoot(readings);
  assert(root === expected, `Expected ${expected}, got ${root}`);
  return `root=${root.slice(0, 16)}...`;
});

// TC-MT-04: Even count (4) — standard binary tree
runCheck("TC-MT-04", "Even count (4): standard binary tree, valid 64-char hex", () => {
  const readings = Array.from({ length: 4 }, (_, i) => mkReading(i));
  const root = buildMerkleRoot(readings);
  assert(/^[0-9a-f]{64}$/.test(root), `Invalid hex: ${root}`);
  return `root=${root.slice(0, 16)}...`;
});

// TC-MT-05: Large batch (60 readings)
runCheck("TC-MT-05", "Large batch (60): completes, valid 64-char hex root", () => {
  const readings = Array.from({ length: 60 }, (_, i) => mkReading(i));
  const root = buildMerkleRoot(readings);
  assert(/^[0-9a-f]{64}$/.test(root), `Invalid hex: ${root}`);
  return `root=${root.slice(0, 16)}...`;
});

// TC-MT-06: Determinism — same inputs, same order → identical root every time
runCheck("TC-MT-06", "Determinism: same input produces identical root across 3 runs", () => {
  const readings = Array.from({ length: 10 }, (_, i) => mkReading(i));
  const a = buildMerkleRoot(readings);
  const b = buildMerkleRoot(readings);
  const c = buildMerkleRoot([...readings]);
  assert(a === b && b === c, `Non-deterministic: ${a}, ${b}, ${c}`);
  return `stable across 3 calls`;
});

// TC-MT-07: Tamper detection — altering one leaf changes root
runCheck("TC-MT-07", "Tamper detection: 1 altered reading produces different root", () => {
  const readings = Array.from({ length: 5 }, (_, i) => mkReading(i));
  const original = buildMerkleRoot(readings);
  const tampered = readings.map((r, i) => i === 2 ? { ...r, solarWatts: 9999 } : r);
  const newRoot = buildMerkleRoot(tampered);
  assert(original !== newRoot, "Tampered root matched original — tamper detection broken");
  return `original=${original.slice(0, 12)}... tampered=${newRoot.slice(0, 12)}...`;
});

// TC-MT-08: Leaf hash composition — SHA-256("plantId|solarWatts|gridWatts|ts")
runCheck("TC-MT-08", "Leaf composition: SHA-256(plantId|solarWatts|gridWatts|ts) pipe-delimited", () => {
  const r = mkReading(7);
  const expected = sha256(`${r.plantId}|${r.solarWatts}|${r.gridWatts}|${r.ts}`);
  const actual = buildLeafHash(r.plantId, r.solarWatts, r.gridWatts, r.ts);
  assert(actual === expected, `Expected ${expected}, got ${actual}`);
  return `leaf=${actual.slice(0, 16)}...`;
});

// TC-MT-09: Empty batch → handled error, not crash
runCheck("TC-MT-09", "Empty batch: throws handled error with 'empty' message", () => {
  let threw = false;
  try {
    buildMerkleRoot([]);
  } catch (e) {
    threw = /empty/i.test(e.message);
  }
  assert(threw, "Empty batch did not throw a handled 'empty' error");
  return "throws Error('Cannot build Merkle root from empty readings array')";
});

writeResults();

const passed = results.filter(r => r.passed).length;
console.log(`\n=== Summary: ${passed}/${results.length} passed ===`);
process.exit(passed === results.length ? 0 : 1);
