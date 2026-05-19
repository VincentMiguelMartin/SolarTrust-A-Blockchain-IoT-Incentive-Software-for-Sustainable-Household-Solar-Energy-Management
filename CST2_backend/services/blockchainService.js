const axios = require("axios");

const BLOCKFROST_URL = "https://cardano-preprod.blockfrost.io/api/v0";
const POLL_INTERVAL_MS = 15000;
const POLL_MAX_ATTEMPTS = 20;

// Lucid is loaded lazily so startup doesn't fail if WALLET_SEED_PHRASE is missing
let _lucid = null;

async function getLucid() {
  if (_lucid) return _lucid;

  const { Lucid, Blockfrost, PROTOCOL_PARAMETERS_DEFAULT } = await import(
    "lucid-cardano"
  );

  const provider = new Blockfrost(
    BLOCKFROST_URL,
    process.env.BLOCKFROST_PROJECT_ID
  );

  // ── Workaround for lucid-cardano@0.10.11 (final, abandoned release) ──────
  // After a Cardano hard fork, Blockfrost's /epochs/latest/parameters returns
  // more Plutus cost-model entries than the CML bundled in this Lucid can
  // index. Lucid's createCostModels() does costModel.set(index, …) for every
  // entry, so the extra ones throw "CostModel operation N out of bounds" at
  // Lucid.new() — before any tx is even built.
  //
  // Our batch tx is metadata-only (label 674, no Plutus scripts, no
  // redeemers), so cost-model VALUES never affect tx validity or the hash.
  // We trim each array to the exact length Lucid's own shipped defaults use
  // (PlutusV1=166, PlutusV2=175) — derived here, not hard-coded, so it stays
  // correct if the bundled Lucid ever changes. Proper long-term fix is
  // migrating to @lucid-evolution/lucid.
  const limit = {
    PlutusV1: Object.keys(PROTOCOL_PARAMETERS_DEFAULT.costModels.PlutusV1)
      .length,
    PlutusV2: Object.keys(PROTOCOL_PARAMETERS_DEFAULT.costModels.PlutusV2)
      .length,
  };
  const trim = (model, max) =>
    model ? Object.fromEntries(Object.entries(model).slice(0, max)) : model;

  const originalGetProtocolParameters =
    provider.getProtocolParameters.bind(provider);
  provider.getProtocolParameters = async () => {
    const pp = await originalGetProtocolParameters();
    if (pp && pp.costModels) {
      pp.costModels = {
        ...pp.costModels,
        PlutusV1: trim(pp.costModels.PlutusV1, limit.PlutusV1),
        PlutusV2: trim(pp.costModels.PlutusV2, limit.PlutusV2),
      };
    }
    return pp;
  };

  _lucid = await Lucid.new(provider, "Preprod");

  if (!process.env.WALLET_SEED_PHRASE) {
    throw new Error("WALLET_SEED_PHRASE is not set in environment variables");
  }

  _lucid.selectWalletFromSeed(process.env.WALLET_SEED_PHRASE);
  return _lucid;
}

// Cardano metadata strings have a 64-byte limit — truncate safely
function metaStr(value) {
  return String(value).slice(0, 64);
}

async function submitBatch(plantId, merkleRoot, batchSize, periodStart, periodEnd) {
  const T3 = new Date();
  console.log(`[blockchainService] T3 batch start: ${T3.toISOString()}`);
  console.log(`[blockchainService] Merkle Root: ${merkleRoot}`);

  const lucid = await getLucid();

  const tx = await lucid
    .newTx()
    .attachMetadata(674, {
      merkleRoot: metaStr(merkleRoot),
      batchSize,
      plantId: metaStr(plantId),
      periodStart: metaStr(periodStart),
      periodEnd: metaStr(periodEnd),
    })
    .complete();

  const signedTx = await tx.sign().complete();
  const txHash = await signedTx.submit();

  console.log(`[blockchainService] Submitted txHash: ${txHash}`);

  // Poll Blockfrost for confirmation
  let confirmed = false;
  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    try {
      const { data } = await axios.get(`${BLOCKFROST_URL}/txs/${txHash}`, {
        headers: { project_id: process.env.BLOCKFROST_PROJECT_ID },
      });

      if (data && data.hash) {
        confirmed = true;
        const T4 = new Date();
        const feeAda = (parseInt(data.fees, 10) / 1_000_000).toFixed(6);
        console.log(`[blockchainService] T4 confirmed: ${T4.toISOString()}`);
        console.log(`[blockchainService] Latency: ${T4 - T3}ms`);
        console.log(`[blockchainService] Fee: ${feeAda} ADA`);
        break;
      }
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log(
          `[blockchainService] Poll ${attempt}/${POLL_MAX_ATTEMPTS} — tx not yet on-chain`
        );
      } else {
        throw err;
      }
    }
  }

  if (!confirmed) {
    throw new Error(
      `Transaction ${txHash} not confirmed after ${POLL_MAX_ATTEMPTS} attempts (~5 minutes)`
    );
  }

  return { txHash, confirmed: true };
}

// Utility: generate a new wallet seed phrase (run once, save result to .env)
async function generateWallet() {
  const { Lucid, Blockfrost, generateSeedPhrase } = await import("lucid-cardano");
  const lucid = await Lucid.new(
    new Blockfrost(BLOCKFROST_URL, process.env.BLOCKFROST_PROJECT_ID),
    "Preprod"
  );
  const seed = generateSeedPhrase();
  lucid.selectWalletFromSeed(seed);
  const address = await lucid.wallet.address();
  return { seed, address };
}

module.exports = { submitBatch, generateWallet, getLucid };
