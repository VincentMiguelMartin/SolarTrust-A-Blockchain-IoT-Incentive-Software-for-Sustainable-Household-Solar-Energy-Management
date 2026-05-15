// Single-use precheck for the e2e-pipeline run. Reads WALLET_SEED_PHRASE from
// .env in memory, derives the Preprod address via Lucid (same path as
// services/blockchainService), queries Blockfrost for the balance, and prints
// only the total tADA. The address itself is NOT printed or logged.
require("dotenv").config();
const axios = require("axios");

const BLOCKFROST_URL = "https://cardano-preprod.blockfrost.io/api/v0";

(async () => {
  const projectId = process.env.BLOCKFROST_PROJECT_ID || "";
  if (!projectId.startsWith("preprod")) {
    console.error(`REFUSING TO RUN: BLOCKFROST_PROJECT_ID is not a Preprod key.`);
    process.exit(1);
  }
  if (!process.env.WALLET_SEED_PHRASE) {
    console.error("WALLET_SEED_PHRASE not set in .env");
    process.exit(1);
  }

  const { Lucid, Blockfrost } = await import("lucid-cardano");
  const lucid = await Lucid.new(new Blockfrost(BLOCKFROST_URL, projectId), "Preprod");
  lucid.selectWalletFromSeed(process.env.WALLET_SEED_PHRASE);
  const address = await lucid.wallet.address();

  try {
    const { data } = await axios.get(
      `${BLOCKFROST_URL}/addresses/${address}`,
      { headers: { project_id: projectId } }
    );
    const lovelace = data.amount.find(a => a.unit === "lovelace");
    const tAda = lovelace ? parseInt(lovelace.quantity, 10) / 1_000_000 : 0;
    console.log(`Wallet balance: ${tAda.toFixed(6)} tADA`);
    // Default 5-cycle run: harness estimate ~0.18 tADA per cycle = ~0.9 tADA.
    // Add a small safety margin for fee variance.
    const NEEDED = 1.0;
    if (tAda >= NEEDED) {
      console.log(`SUFFICIENT (need >= ${NEEDED} tADA for 5-cycle run).`);
      process.exit(0);
    } else {
      console.log(`INSUFFICIENT (need >= ${NEEDED} tADA). Top up at https://docs.cardano.org/cardano-testnets/tools/faucet/`);
      process.exit(2);
    }
  } catch (err) {
    if (err.response?.status === 404) {
      console.log(`Wallet balance: 0 tADA (address never received funds)`);
      console.log(`INSUFFICIENT. Top up at https://docs.cardano.org/cardano-testnets/tools/faucet/`);
      process.exit(2);
    }
    console.error(`Blockfrost lookup failed: ${err.message}`);
    process.exit(1);
  }
})();
