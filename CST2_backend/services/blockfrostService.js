const axios = require("axios");
const crypto = require("crypto");

const PROJECT_ID = process.env.BLOCKFROST_PROJECT_ID;
const NETWORK = process.env.BLOCKFROST_NETWORK || "preprod";

const BASE_URL =
  NETWORK === "mainnet"
    ? "https://cardano-mainnet.blockfrost.io/api/v0"
    : `https://cardano-${NETWORK}.blockfrost.io/api/v0`;

function blockfrostHeaders() {
  return { project_id: PROJECT_ID };
}

function hashReading(plantId, solarWatts, gridWatts, ts) {
  const raw = `${plantId}|${solarWatts}|${gridWatts}|${ts}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function getLatestBlock() {
  const { data } = await axios.get(`${BASE_URL}/blocks/latest`, {
    headers: blockfrostHeaders(),
  });
  return {
    hash: data.hash,
    height: data.height,
    slot: data.slot,
    epoch: data.epoch,
  };
}

async function submitMetadata(merkleRoot, batchSize, periodStart, periodEnd, plantId) {
  const metadata = {
    674: {
      merkleRoot,
      batchSize,
      periodStart,
      periodEnd,
      plantId,
    },
  };

  const { data } = await axios.post(
    `${BASE_URL}/tx/submit`,
    { metadata },
    { headers: { ...blockfrostHeaders(), "Content-Type": "application/json" } }
  );

  return data.tx_hash || data;
}

async function getTransactionStatus(txHash) {
  try {
    const { data } = await axios.get(`${BASE_URL}/txs/${txHash}`, {
      headers: blockfrostHeaders(),
    });
    return {
      found: true,
      block: data.block,
      slot: data.slot,
    };
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return { found: false, block: null, slot: null };
    }
    throw err;
  }
}

async function getWalletUtxos(address) {
  const { data } = await axios.get(`${BASE_URL}/addresses/${address}/utxos`, {
    headers: blockfrostHeaders(),
  });
  return data;
}

module.exports = {
  hashReading,
  getLatestBlock,
  submitMetadata,
  getTransactionStatus,
  getWalletUtxos,
};
