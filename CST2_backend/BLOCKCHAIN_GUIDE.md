# SolarTrust Blockchain Guide

Guide for the team on how to set up, test, and verify the Cardano blockchain integration.

---

## 1. Prerequisites

- **Node.js** v18 or higher (`node --version` to check)
- **npm** installed
- A free account on [blockfrost.io](https://blockfrost.io) // GOODS NA TONG TWO
- Access to the Supabase project dashboard

---

## 2. Environment Setup

### 2.1 Install dependencies

```bash
cd CST2_backend
npm install
npm install lucid-cardano
```

### 2.2 Configure .env

Copy `.env.example` or create `CST2_backend/.env` with these variables:

```
PORT=3000
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
TANEKO_PLANT_ID=TTC60011
TANEKO_API_KEY=your_taneko_api_key
BLOCKFROST_PROJECT_ID=preprodYOUR_KEY_HERE
BLOCKFROST_NETWORK=preprod
WALLET_SEED_PHRASE=your 24 word seed phrase here
CARDANO_WALLET_ADDRESS=addr_test1your_address_here
```

**Where to get each value:**

| Variable | Where to find it |
|----------|-----------------|
| `SUPABASE_URL` | Supabase Dashboard > Settings > API > Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard > Settings > API > service_role key |
| `BLOCKFROST_PROJECT_ID` | blockfrost.io > Your Project > Project ID |
| `WALLET_SEED_PHRASE` | Generated once (see section 3) |
| `CARDANO_WALLET_ADDRESS` | Generated once (see section 3) |

> **IMPORTANT:** Never commit `.env` to git. Never share seed phrases or API keys in chat, email, or screenshots.

### 2.3 Get a Blockfrost API key

1. Go to [blockfrost.io](https://blockfrost.io) and sign up (free)
2. Click **Add new project**
3. Select **Cardano Preprod** as the network
4. Copy the **project_id** (starts with `preprod`)
5. Paste into `.env` as `BLOCKFROST_PROJECT_ID`

---

## 3. Wallet Setup (one-time)

### 3.1 Generate a Cardano Preprod wallet

```bash
cd CST2_backend
node scripts/generateWallet.js
```

This prints a 24-word seed phrase and an `addr_test1...` address. Copy both into your `.env`.

**Back up the seed phrase.** Anyone with it controls the wallet. If lost, the wallet is gone.

### 3.2 Fund the wallet with test ADA

1. Go to: https://docs.cardano.org/cardano-testnet/tools/faucet
2. Select **Preprod**
3. Paste your `addr_test1...` address
4. Click **Request funds**
5. Wait ~2 minutes

You'll receive 10,000 tADA (test ADA, no real value). Each blockchain transaction costs ~0.2 tADA.

### 3.3 Verify wallet is funded

After funding, check your balance at:
```
https://preprod.cardanoscan.io/address/YOUR_ADDRESS_HERE
```

---

## 4. Database Setup

Run this SQL in the **Supabase SQL Editor** (Dashboard > SQL Editor > New query):

```sql
-- Add blockchain columns to readings table
ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS reading_hash TEXT,
  ADD COLUMN IF NOT EXISTS blockchain_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cardano_block BIGINT,
  ADD COLUMN IF NOT EXISTS cardano_slot BIGINT,
  ADD COLUMN IF NOT EXISTS merkle_root TEXT,
  ADD COLUMN IF NOT EXISTS batch_id UUID,
  ADD COLUMN IF NOT EXISTS export_watts NUMERIC;

-- Create blockchain_batches table
CREATE TABLE IF NOT EXISTS blockchain_batches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id     TEXT NOT NULL,
  merkle_root  TEXT NOT NULL,
  tx_hash      TEXT NOT NULL,
  batch_size   INT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end   TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 5. Running the Server

```bash
cd CST2_backend
npm start
```

You should see:
```
File is running...
Server running on port 3000
```

Open a **second terminal** to run test commands (Ctrl+Shift+` in VS Code).

---

## 6. API Endpoints

### Check Cardano connection
```
GET http://localhost:3000/blockchain/status
```
Returns `connected: true` if Blockfrost is configured correctly.

### Record a single energy reading
```
POST http://localhost:3000/blockchain/record
Content-Type: application/json

{
  "plantId": "TTC60011",
  "solarWatts": 1200,
  "gridWatts": 50,
  "exportWatts": 300,
  "ts": "2026-04-09T06:00:00Z"
}
```
Hashes the reading, saves it to Supabase with `blockchain_status = pending`.

### Batch pending readings onto Cardano
```
POST http://localhost:3000/blockchain/batch
Content-Type: application/json

{ "plantId": "TTC60011" }
```
Builds a Merkle tree from all pending readings, submits the root to Cardano, and updates readings to `confirmed`. This takes up to 5 minutes (polling for on-chain confirmation).

### Check a transaction
```
GET http://localhost:3000/blockchain/tx/{txHash}
```

### Check wallet UTXOs
```
GET http://localhost:3000/blockchain/wallet
```

---

## 7. Testing (Step by Step)

### Step 1 — Test Blockfrost connection

**PowerShell:**
```powershell
Invoke-RestMethod http://localhost:3000/blockchain/status
```

Must return `connected: true`. If not, check `BLOCKFROST_PROJECT_ID` in `.env` and restart the server.

### Step 2 — Record test readings

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/blockchain/record -ContentType "application/json" -Body '{"plantId":"TTC60011","solarWatts":1200,"gridWatts":50,"exportWatts":300,"ts":"2026-04-09T06:00:00Z"}'

Invoke-RestMethod -Method Post -Uri http://localhost:3000/blockchain/record -ContentType "application/json" -Body '{"plantId":"TTC60011","solarWatts":1500,"gridWatts":30,"exportWatts":400,"ts":"2026-04-09T06:15:00Z"}'

Invoke-RestMethod -Method Post -Uri http://localhost:3000/blockchain/record -ContentType "application/json" -Body '{"plantId":"TTC60011","solarWatts":1800,"gridWatts":20,"exportWatts":500,"ts":"2026-04-09T06:30:00Z"}'
```

Each returns a `readingId` and `readingHash`.

### Step 3 — Submit batch to Cardano

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/blockchain/batch -ContentType "application/json" -Body '{"plantId":"TTC60011"}'
```

Wait for it to return (up to 5 minutes). On success you get: `merkleRoot`, `txHash`, `confirmed: true`, `batchSize`.

### Step 4 — Verify on CardanoScan

Open in browser:
```
https://preprod.cardanoscan.io/transaction/PASTE_TX_HASH_HERE
```

Click the **Metadata** tab. You should see label `674` containing the `merkleRoot`, `plantId`, `batchSize`, `periodStart`, `periodEnd`.

### Step 5 — Verify in Supabase

Run in the Supabase SQL Editor:

```sql
SELECT id, ts, solar_watts, reading_hash, blockchain_status, merkle_root
FROM readings WHERE household_id = 'TTC60011' ORDER BY ts DESC;

SELECT * FROM blockchain_batches ORDER BY created_at DESC LIMIT 5;
```

Readings should show `blockchain_status = confirmed` with a `merkle_root` value.

---

## 8. How Verification Works

The system uses a **Merkle tree** to create a single hash (the Merkle root) that represents an entire batch of energy readings. This root is stored on the Cardano blockchain as transaction metadata.

**To verify readings have not been tampered with:**

1. Take the raw readings from a batch
2. Recompute the Merkle root using SHA-256
3. Compare it with the root stored on-chain (via CardanoScan)
4. If they match, the data is verified untampered

**Verification script** (save as `verify.js` and run with `node verify.js`):

```js
const crypto = require("crypto");

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// Replace these with the actual readings from your batch
const readings = [
  { plantId: "TTC60011", solarWatts: 1200, gridWatts: 50, ts: "2026-04-09T06:00:00Z" },
  { plantId: "TTC60011", solarWatts: 1500, gridWatts: 30, ts: "2026-04-09T06:15:00Z" },
  { plantId: "TTC60011", solarWatts: 1800, gridWatts: 20, ts: "2026-04-09T06:30:00Z" },
];

let level = readings.map(r =>
  sha256(`${r.plantId}|${r.solarWatts}|${r.gridWatts}|${r.ts}`)
);

while (level.length > 1) {
  if (level.length % 2 !== 0) level.push(level[level.length - 1]);
  const next = [];
  for (let i = 0; i < level.length; i += 2) {
    next.push(sha256(level[i] + level[i + 1]));
  }
  level = next;
}

console.log("Recomputed Merkle Root:", level[0]);
console.log("Compare this with the merkleRoot on CardanoScan (Metadata tab, label 674)");
```

If the output matches the `merkleRoot` on CardanoScan, the readings are proven authentic.

---

## 9. Automated Cron Jobs

The server runs two automated schedules:

| Schedule | What it does |
|----------|-------------|
| Every 15 minutes | Fetches live IoT data from Taneko and saves each reading with a hash |
| Every 6 hours | Batches all pending readings, builds Merkle tree, submits root to Cardano |

These run automatically while the server is running. Check the server terminal for logs like:
```
[tanekoCron] Saved reading — id: ..., hash: ...
[tanekoCron] T3 batch start: ...
[tanekoCron] T4 confirmed: ...
```

---

## 10. Troubleshooting

| Problem | Solution |
|---------|----------|
| `connected: false` on `/blockchain/status` | Check `BLOCKFROST_PROJECT_ID` in `.env`, restart server |
| `WALLET_SEED_PHRASE is not set` | Add the seed phrase to `.env`, restart server |
| `not enough ADA` | Fund wallet at the Cardano testnet faucet |
| `fetch failed` on Supabase calls | Check `SUPABASE_URL` ends in `.supabase.co` (not `.com`), restart server |
| `Column not found` errors | Run the SQL from section 4 in Supabase |
| Transaction not confirming | Preprod can be slow. Check txHash on CardanoScan manually |
| `No exports main defined` for lucid-cardano | Make sure `npm install lucid-cardano` ran in CST2_backend |
| Changes to `.env` not taking effect | Always restart the server after editing `.env` |

---

## 11. Architecture Overview

```
Taneko IoT API
     |
     v  (every 15 min)
[tanekoCron] --> recordEnergyOnChain()
     |               |
     |               +--> SHA-256 hash of reading
     |               +--> Save to Supabase (status: pending)
     |
     v  (every 6 hours)
[tanekoCron] --> buildMerkleRoot() --> submitBatch()
                      |                     |
                      |                     +--> Lucid builds tx with metadata label 674
                      |                     +--> Signs with wallet seed phrase
                      |                     +--> Submits to Cardano Preprod via Blockfrost
                      |                     +--> Polls until confirmed
                      |
                      +--> Update Supabase: readings = confirmed, save merkle_root + batch_id
```

---

## 12. Key Files

| File | Purpose |
|------|---------|
| `services/blockchainService.js` | Builds and submits Cardano transactions using Lucid |
| `services/blockfrostService.js` | Blockfrost API calls (block info, tx status, wallet UTXOs) |
| `services/merkleService.js` | Merkle tree construction and verification |
| `services/blockchainRecordService.js` | Records readings and runs batch logic |
| `cron/tanekoCron.js` | Automated 15-min fetch and 6-hour batch schedules |
| `scripts/generateWallet.js` | One-time wallet generation script |
| `server.js` | Express server with all API routes |
