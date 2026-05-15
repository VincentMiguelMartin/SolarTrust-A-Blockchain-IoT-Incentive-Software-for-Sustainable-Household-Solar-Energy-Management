// One-shot cleanup for a failed e2e-pipeline RUN_ID.
// Usage: RUN_ID=E2E_1778767318721 node tests/_cleanup-failed-run.js
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const runId = process.env.RUN_ID;
  if (!runId || !runId.startsWith("E2E_")) {
    console.error('Set RUN_ID env (e.g. RUN_ID=E2E_1778767318721) — must start with "E2E_".');
    process.exit(1);
  }

  // 1) Look up any readings with household_id starting with the RUN_ID.
  const { data: readings, error: selErr } = await supabase
    .from("readings")
    .select("id, household_id, blockchain_status, merkle_root")
    .like("household_id", `${runId}%`);
  if (selErr) {
    console.error(`Select failed: ${selErr.message}`);
    process.exit(1);
  }
  console.log(`Found ${readings.length} readings under ${runId}*`);
  const byHH = {};
  for (const r of readings) {
    byHH[r.household_id] = byHH[r.household_id] || { total: 0, confirmed: 0, pending: 0, roots: new Set() };
    byHH[r.household_id].total++;
    if (r.blockchain_status === "confirmed") byHH[r.household_id].confirmed++;
    else byHH[r.household_id].pending++;
    if (r.merkle_root) byHH[r.household_id].roots.add(r.merkle_root);
  }
  for (const hh of Object.keys(byHH).sort()) {
    const b = byHH[hh];
    console.log(`  ${hh}: total=${b.total} confirmed=${b.confirmed} pending=${b.pending} roots=${b.roots.size}`);
  }

  // 2) Delete readings.
  const { error: delReadingsErr } = await supabase
    .from("readings")
    .delete()
    .like("household_id", `${runId}%`);
  if (delReadingsErr) {
    console.error(`Delete readings failed: ${delReadingsErr.message}`);
    process.exit(1);
  }
  console.log(`Deleted ${readings.length} readings.`);

  // 3) Delete batch records keyed by the merkle roots we collected.
  const roots = new Set();
  for (const r of readings) if (r.merkle_root) roots.add(r.merkle_root);
  if (roots.size > 0) {
    const { data: batches, error: bSelErr } = await supabase
      .from("blockchain_batches")
      .select("id, tx_hash, merkle_root")
      .in("merkle_root", [...roots]);
    if (bSelErr) {
      console.error(`Batch lookup failed: ${bSelErr.message}`);
    } else {
      console.log(`Found ${batches.length} blockchain_batches rows tied to this run's merkle_roots.`);
      const { error: bDelErr } = await supabase
        .from("blockchain_batches")
        .delete()
        .in("merkle_root", [...roots]);
      if (bDelErr) {
        console.error(`Batch delete failed: ${bDelErr.message}`);
      } else {
        console.log(`Deleted ${batches.length} blockchain_batches rows.`);
      }
    }
  } else {
    console.log(`No merkle_roots found on readings — no blockchain_batches rows to delete.`);
  }

  console.log(`\nCleanup complete for ${runId}.`);
  console.log(`Note: the 3 confirmed Cardano txs from cycles 1-3 (Preprod testnet) are permanent on-chain — that is expected and unavoidable.`);
})();
