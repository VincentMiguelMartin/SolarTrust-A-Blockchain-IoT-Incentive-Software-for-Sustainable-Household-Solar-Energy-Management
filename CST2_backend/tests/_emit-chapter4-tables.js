// Parse the latest reward-microbench_<ts>.json and e2e-pipeline_<ts>.json from
// tests/results/ and emit the three drop-in blocks for Chapter 4 Tables 3, 4, 6.
//
// Formatting rules (from prompt):
//   - Sample SD via Bessel's correction (already done in source JSONs).
//   - ADA fees: 6 decimal places.
//   - Latencies: seconds, 1 decimal place.
//   - Tx hashes: first 16 chars + ellipsis.
const fs = require("fs");
const path = require("path");

const resultsDir = path.join(__dirname, "results");

function latestMatching(prefix) {
  const files = fs.readdirSync(resultsDir).filter((f) => f.startsWith(prefix) && f.endsWith(".json"));
  files.sort();
  return files.length ? path.join(resultsDir, files[files.length - 1]) : null;
}

const rewardPath = latestMatching("reward-microbench_");
const e2ePath = latestMatching("e2e-pipeline_");
if (!rewardPath) { console.error("No reward-microbench_*.json found."); process.exit(1); }
if (!e2ePath)    { console.error("No e2e-pipeline_*.json found.");    process.exit(1); }

const reward = JSON.parse(fs.readFileSync(rewardPath, "utf8"));
const e2e = JSON.parse(fs.readFileSync(e2ePath, "utf8"));

console.log(`Source files:`);
console.log(`  Table 3 row  : ${path.relative(process.cwd(), rewardPath)}`);
console.log(`  Tables 4 + 6 : ${path.relative(process.cwd(), e2ePath)}\n`);

// ── Table 3, last row ──
const rMean = reward.stats.mean;
const rSd = reward.stats.sd;
const rN = reward.stats.n;
console.log(`=== Table 3, last row ===`);
console.log(`Dynamic Reward Allocation, server-side only (${rN} batches) | ${rN} batches | ${rMean} ± ${rSd} | Mean across ${rN} microbenchmark runs of computeReward()\n`);

// ── Table 4 ──
console.log(`=== Table 4 ===`);
const cycles = e2e.cycleDetails;
for (const c of cycles) {
  const short = c.txHash ? c.txHash.slice(0, 16) + "…" : "(none)";
  const fee = c.feeAda != null ? c.feeAda.toFixed(6) : "n/a";
  console.log(`Batch ${c.cycle} | ${short} | ${fee}`);
}
const meanAda = e2e.transactionFee.ada.mean.toFixed(6);
const sdAda = e2e.transactionFee.ada.sd.toFixed(6);
console.log(`Mean Fee | — | ${meanAda} ADA (σ = ${sdAda})\n`);

// ── Table 6 ──
console.log(`=== Table 6 ===`);
for (const c of cycles) {
  const readings = c.readingsPerBatch ?? "?";
  const t3 = c.t3Iso || "n/a";
  const t4 = c.t4Iso || "n/a";
  const latS = c.latencyS != null ? c.latencyS.toFixed(1) : ((c.batchMs / 1000).toFixed(1));
  console.log(`Batch ${c.cycle} | ${readings} | ${t3} | ${t4} | ${latS}`);
}
const meanS = (e2e.batchLatency.mean / 1000).toFixed(1);
const sdS = (e2e.batchLatency.sd / 1000).toFixed(1);
console.log(`Mean   | — | — | — | ${meanS}`);
console.log(`Std    | — | — | — | ${sdS}`);
