const axios = require("axios");

const BLOCKFROST_URL = "https://cardano-preprod.blockfrost.io/api/v0";
const POLL_INTERVAL_MS = 15000;
const POLL_MAX_ATTEMPTS = 20;

// Lucid is loaded lazily so startup doesn't fail if WALLET_SEED_PHRASE is missing
let _lucid = null;

async function getLucid() {
  if (_lucid) return _lucid;

  const { Lucid, Blockfrost } = await import("lucid-cardano");

  _lucid = await Lucid.new(
    new Blockfrost(BLOCKFROST_URL, process.env.BLOCKFROST_PROJECT_ID),
    "Preprod"
  );

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

module.exports = { submitBatch, generateWallet };
