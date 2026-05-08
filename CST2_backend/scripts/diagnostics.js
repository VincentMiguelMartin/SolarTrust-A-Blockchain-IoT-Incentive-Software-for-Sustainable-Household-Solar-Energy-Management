// Run with: node scripts/diagnostics.js
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const { fetchPlantLive } = require("../services/tanekoService");
const { getLatestBlock } = require("../services/blockfrostService");
const { buildMerkleRoot, buildMerkleTree, verifyReading } = require("../services/merkleService");
const { computeReward } = require("../services/rewardService");

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const results = [];

/**
 * Runs a single diagnostic check, catches any error, and records the result.
 * @param {number} num - Check number (1-10).
 * @param {string} name - Short description of the check.
 * @param {() => Promise<string>} fn - Async function that returns a detail string on success or throws on failure.
 */
async function runCheck(num, name, fn) {
  const label = `CHECK ${num}`;
  try {
    const detail = await fn();
    console.log(`\n  ${label} -- ${name}`);
    console.log(`  Result: PASS ${detail}`);
    results.push({ num, name, passed: true });
  } catch (err) {
    console.log(`\n  ${label} -- ${name}`);
    console.log(`  Result: FAIL ${err.message}`);
    results.push({ num, name, passed: false, error: err.message });
  }
}

// ──────────────────────────────────────────────
// Checks
// ──────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  SolarTrust System Diagnostics");
  console.log("  " + new Date().toISOString());
  console.log("=".repeat(60));

  // ── CHECK 1: Environment Variables ──────────────────────────
  await runCheck(1, "Environment Variables", async () => {
    const required = [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "BLOCKFROST_PROJECT_ID",
      "TANEKO_API_KEY",
      "TANEKO_PLANT_ID",
      "WALLET_SEED_PHRASE",
      "BLOCKFROST_NETWORK",
      "CARDANO_WALLET_ADDRESS",
    ];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(`Missing: ${missing.join(", ")}`);
    }
    return `All ${required.length} variables present`;
  });

  // ── CHECK 2: Supabase Connection ───────────────────────────
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  await runCheck(2, "Supabase Connection", async () => {
    const { data, error } = await supabase
      .from("readings")
      .select("id")
      .limit(1);
    if (error) throw new Error(error.message);
    return `Connected (${data.length} row returned)`;
  });

  // ── CHECK 3: Supabase Tables Exist ─────────────────────────
  await runCheck(3, "Supabase Tables Exist", async () => {
    const tables = ["readings", "blockchain_batches", "households"];
    const missing = [];
    for (const table of tables) {
      const { error } = await supabase.from(table).select("id").limit(1);
      if (error) missing.push(`${table} (${error.message})`);
    }
    if (missing.length > 0) {
      throw new Error(`Missing tables: ${missing.join(", ")}`);
    }
    return `All ${tables.length} tables accessible`;
  });

  // ── CHECK 4: Taneko API Connection ─────────────────────────
  await runCheck(4, "Taneko API Connection", async () => {
    const plantId = process.env.TANEKO_PLANT_ID;
    const t0 = Date.now();
    const payload = await fetchPlantLive(plantId);
    const ms = Date.now() - t0;
    const values = Array.isArray(payload?.values) ? payload.values : [];
    if (values.length === 0) {
      throw new Error("Response contained no values");
    }
    const latest = values[0];
    const solarWatts = Number(latest.sap ?? 0);
    return `${values.length} reading(s), latest solarWatts=${solarWatts}W [${ms}ms]`;
  });

  // ── CHECK 5: Blockfrost / Cardano Connection ───────────────
  await runCheck(5, "Blockfrost / Cardano Connection", async () => {
    const t0 = Date.now();
    const block = await getLatestBlock();
    const ms = Date.now() - t0;
    if (!block.hash || !block.height || !block.slot || !block.epoch) {
      throw new Error("Incomplete block data: " + JSON.stringify(block));
    }
    return `height=${block.height}, slot=${block.slot}, epoch=${block.epoch} [${ms}ms]`;
  });

  // ── CHECK 6: Merkle Tree Construction ──────────────────────
  const fakeReadings = Array.from({ length: 5 }, (_, i) => ({
    plantId: "TEST",
    solarWatts: 100 + i,
    gridWatts: 50 + i,
    ts: new Date().toISOString(),
  }));

  let merkleRootHex = null;

  await runCheck(6, "Merkle Tree Construction", async () => {
    merkleRootHex = buildMerkleRoot(fakeReadings);
    if (typeof merkleRootHex !== "string" || !/^[0-9a-f]{64}$/.test(merkleRootHex)) {
      throw new Error(`Invalid root format: ${merkleRootHex}`);
    }
    return `Root=${merkleRootHex.slice(0, 16)}...`;
  });

  // ── CHECK 7: Merkle Tree Tamper Detection ──────────────────
  await runCheck(7, "Merkle Tree Tamper Detection", async () => {
    const original = buildMerkleRoot(fakeReadings);
    const tampered = fakeReadings.map((r, i) =>
      i === 2 ? { ...r, solarWatts: 9999 } : { ...r }
    );
    const tamperedRoot = buildMerkleRoot(tampered);
    if (original === tamperedRoot) {
      throw new Error("Roots are identical — tamper detection broken");
    }
    return `Original=${original.slice(0, 12)}... vs Tampered=${tamperedRoot.slice(0, 12)}... (different)`;
  });

  // ── CHECK 8: Supabase Read and Write ───────────────────────
  await runCheck(8, "Supabase Read and Write", async () => {
    const testTs = new Date().toISOString();
    const t0 = Date.now();

    // Insert
    const { data: inserted, error: insertErr } = await supabase
      .from("readings")
      .insert([
        {
          household_id: "DIAGNOSTIC_TEST",
          ts: testTs,
          solar_watts: 123,
          grid_watts: 456,
          blockchain_status: "pending",
        },
      ])
      .select()
      .single();
    if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

    // Read back
    const { data: rows, error: readErr } = await supabase
      .from("readings")
      .select("*")
      .eq("household_id", "DIAGNOSTIC_TEST")
      .eq("ts", testTs);
    if (readErr) throw new Error(`Read failed: ${readErr.message}`);
    if (!rows || rows.length === 0) throw new Error("Inserted row not found");
    if (rows[0].solar_watts !== 123 || rows[0].grid_watts !== 456) {
      throw new Error("Read-back values do not match inserted values");
    }

    // Cleanup
    const { error: deleteErr } = await supabase
      .from("readings")
      .delete()
      .eq("household_id", "DIAGNOSTIC_TEST");
    if (deleteErr) throw new Error(`Cleanup failed: ${deleteErr.message}`);

    const ms = Date.now() - t0;
    return `Insert -> Read -> Delete OK [${ms}ms]`;
  });

  // ── CHECK 9: Reward Formula Check ─────────────────────────
  await runCheck(9, "Reward Formula Check", async () => {
    const result = computeReward({
      energySavedKwh: 50,
      baselineKwh: null,
      networkDemandKw: 0,
      networkCapacityKw: 1,
      timestamp: new Date().toISOString(),
    });
    if (!result || typeof result.reward !== "number") {
      throw new Error(`computeReward returned invalid result: ${JSON.stringify(result)}`);
    }
    if (!Number.isFinite(result.reward) || result.reward <= 0) {
      throw new Error(`Expected positive finite reward, got: ${result.reward}`);
    }
    return `reward=${result.reward}, Wt=${result.breakdown.Wt}, Wn=${result.breakdown.Wn}, Wb=${result.breakdown.Wb}`;
  });

  // ── CHECK 10: End-to-End Pipeline Simulation ──────────────
  await runCheck(10, "End-to-End Pipeline Simulation", async () => {
    // buildMerkleTree and verifyReading use { household_id, solar_watts, grid_watts, ts }
    const pipelineReadings = Array.from({ length: 3 }, (_, i) => ({
      household_id: "PIPELINE_TEST",
      solar_watts: 200 + i * 10,
      grid_watts: 100 + i * 5,
      ts: new Date(Date.now() + i * 1000).toISOString(),
    }));

    // Step 1-2: Build Merkle tree
    const { merkleRoot, leaves } = buildMerkleTree(pipelineReadings);
    if (!merkleRoot || !leaves || leaves.length !== 3) {
      throw new Error("buildMerkleTree returned unexpected structure");
    }

    // Step 3-4: Verify each reading against the tree
    const failures = [];
    for (let i = 0; i < pipelineReadings.length; i++) {
      const ok = verifyReading(pipelineReadings[i], merkleRoot, leaves);
      if (!ok) failures.push(i);
    }
    if (failures.length > 0) {
      throw new Error(`Readings at index [${failures.join(", ")}] failed verification`);
    }

    return `3/3 readings verified against root=${merkleRoot.slice(0, 16)}...`;
  });

  // ──────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("  SUMMARY");
  console.log("=".repeat(60));

  for (const r of results) {
    const icon = r.passed ? "PASS" : "FAIL";
    console.log(`  ${icon}  Check ${r.num}: ${r.name}`);
  }

  const passed = results.filter((r) => r.passed).length;
  console.log("\n" + "-".repeat(60));
  console.log(`  Total: ${passed}/${results.length} checks passed`);

  if (passed === results.length) {
    console.log("  SYSTEM READY -- all connections verified");
  } else {
    console.log("  SYSTEM NOT READY -- fix the above issues before defense");
  }
  console.log("=".repeat(60));

  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error("Diagnostics crashed:", err);
  process.exit(1);
});
