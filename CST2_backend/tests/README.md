# SolarTrust Test Suites

This folder holds every automated test that backs Chapter 4 of the thesis. There are **two suites**:

| Suite | What it measures | Chapter 4 section it feeds |
|---|---|---|
| **Algorithm performance** (`tests/*.test.js`) | F1-score, Merkle correctness, ingestion latency, end-to-end batch latency, Blockfrost fees | 4.2.1, 4.2.2, 4.2.3 |
| **Black box** (`tests/blackbox/`) | Functional suitability, reliability, performance, security, edge cases — runs through HTTP only | 4.1 (Table 1) |

Results are written as JSON to `tests/results/` (algorithm suite) and as an HTML report to `tests/blackbox/reports/blackbox-report.html` (black box suite).

---

## Prerequisites (one-time)

1. **Node.js 18+** installed.
2. From the repo root, install dependencies:
   ```bash
   cd CST2_backend
   npm install
   ```
3. **`.env` file** at `CST2_backend/.env` with at minimum:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `BLOCKFROST_PROJECT_ID` (must start with `preprod` for safety guards)
   - `CARDANO_WALLET_ADDRESS`, `WALLET_SEED_PHRASE`
   - `TANEKO_API_KEY`, `TANEKO_BASE_URL`
   Ask the team lead for the shared `.env` — do not commit it.
4. Supabase tables exist: `readings`, `blockchain_batches`, `households`, `rewards`, `anomaly_log`, `user_profiles`.

---

## Run EVERYTHING (the full thesis-evidence run)

Open **two terminals** in `CST2_backend/`.

**Terminal A — start the backend and leave it running:**
```bash
npm start
```
Wait for `🚀 Server running on port 3000`. Confirm with:
```bash
curl http://127.0.0.1:3000/test
```

**Terminal B — run the four test suites in order:**
```bash
# 1. Merkle tree correctness (offline, ~1 second)
node tests/merkle-tree.test.js

# 2. Anomaly detection + F1-score (needs Supabase, ~10-20 seconds)
node tests/anomaly-detection.test.js

# 3. Black box suite — TC-FS-*, TC-REL-*, TC-PERF-*, TC-SEC-*, TC-EDGE-* (~30-60 seconds)
npm run test:blackbox

# 4. Ingestion latency T1→T2 (10 samples, ~30-60 seconds)
node tests/ingestion-latency.test.js

# 5. End-to-end pipeline — batch latency, fees, on-chain verification
#    (~10-15 minutes, costs ~0.9 tADA on Preprod)
node tests/e2e-pipeline.test.js
```

After step 3, open `tests/blackbox/reports/blackbox-report.html` in a browser for the styled report.

After steps 1, 2, 4, 5, raw measurements are in timestamped JSON files under `tests/results/`.

---

## Run a single suite

| Goal | Command |
|---|---|
| Merkle tests only | `node tests/merkle-tree.test.js` |
| Anomaly + F1 only | `node tests/anomaly-detection.test.js` |
| Black box only | `npm run test:blackbox` |
| Ingestion latency only | `node tests/ingestion-latency.test.js` |
| E2E pipeline only | `node tests/e2e-pipeline.test.js` |
| Black box with custom backend URL | `BLACKBOX_BASE_URL=http://192.168.x.x:3000 npm run test:blackbox` |
| E2E with fewer cycles (saves tADA) | `E2E_BATCH_COUNT=3 node tests/e2e-pipeline.test.js` |

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `ECONNREFUSED 127.0.0.1:3000` | Backend isn't running. Start it in Terminal A with `npm start`. |
| `BLOCKFROST_PROJECT_ID does not start with "preprod"` | Safety guard — switch your `.env` to a Preprod key before running latency / E2E tests. |
| `TC-PERF-03: dashboard fetch is <= 1000ms` fails | Slow network (mobile hotspot). Re-run on Wi-Fi. |
| `400 Bad Request` on seeded `/readings` calls in tests | Your seed timestamps are outside `MAX_TS_DRIFT_MS` (5 min default). Use `new Date().toISOString()` or set `MAX_TS_DRIFT_MS` higher in `.env`. |
| `401` from `/api/rewards/:id` in tests | Expected — that route is now bearer-token protected. TC-SEC-01 verifies this. |
| Old results clutter `tests/results/` | Safe to delete any `*_2026-04*` files; newest run is what Chapter 4 cites. |

---

## What each suite produces for Chapter 4

| Suite | Output file | Chapter 4 table |
|---|---|---|
| `merkle-tree.test.js` | `tests/results/merkle-tree_<ts>.json` | TC-05, TC-06, TC-07 (Table 1) |
| `anomaly-detection.test.js` | `tests/results/anomaly-detection_<ts>.json` | Table 2 (F1-Score) |
| `npm run test:blackbox` | `tests/blackbox/reports/blackbox-report.html` | Table 1 (all 15 TCs) |
| `ingestion-latency.test.js` | `tests/results/ingestion-latency_<ts>.json` | Table 5 (T1→T2) |
| `e2e-pipeline.test.js` | `tests/results/e2e-pipeline_<ts>.json` | Table 4 (fees) + Table 6 (T3→T4) |

---

## Test Files

### `merkle-tree.test.js`

Merkle Tree structural correctness and tamper detection. Pure computation, no network calls.

| TC-ID | Case |
|-------|------|
| TC-MT-01 | Single reading: root equals leaf hash |
| TC-MT-02 | Two readings: root equals SHA-256(leaf1 \|\| leaf2) |
| TC-MT-03 | Odd count (3): last leaf duplicated |
| TC-MT-04 | Even count (4): standard binary tree |
| TC-MT-05 | Large batch (60 readings) |
| TC-MT-06 | Determinism across 3 runs |
| TC-MT-07 | Tamper detection: 1 altered reading changes root |
| TC-MT-08 | Leaf composition: SHA-256(plantId\|solarWatts\|gridWatts\|ts) |
| TC-MT-09 | Empty batch: throws handled error |

**Duration:** < 1 second

---

### `anomaly-detection.test.js`

Z-Score anomaly detection validation (Part A) and F1-Score measurement (Part B).

Seeds 30 synthetic historical readings (mean ~3400W, sd ~198W) then runs individual cases and a 50-reading ground-truth dataset.

| TC-ID | Case |
|-------|------|
| TC-AD-01 | Normal 3500W accepted |
| TC-AD-02 | Negative -50W flagged (physical bounds) |
| TC-AD-03 | 99999W exceeds physical max |
| TC-AD-04 | 12000W flagged as z-score outlier |
| TC-AD-05 | Boundary value (mean + 3\*sd) flagged (threshold is exclusive >3) |
| TC-AD-06 | Insufficient history (<5 readings) accepts gracefully |
| TC-AD-07 | Zero stddev: no division-by-zero crash |
| TC-AD-08 | 0W nighttime: z-score anomaly against daytime baseline |
| TC-AD-F1 | **F1-Score >= 80%** on 50-reading ground-truth dataset (30 normal, 20 anomalous) |

Part B injects readings across three anomaly categories (negative, over-capacity, z-score outlier), counts TP/FP/FN/TN, and asserts F1 >= 0.80.

**Requires:** Supabase connectivity
**Duration:** ~10-20 seconds

---

### `ingestion-latency.test.js`

IoT Ingestion Latency (T1 -> T2) measurement.

Calls `recordEnergyOnChain` directly (no HTTP overhead). T1 = function entry, T2 = after Supabase insert. Includes Blockfrost `getLatestBlock()` call which is part of the pipeline.

| TC-ID | Metric |
|-------|--------|
| TC-IL-01 | T1->T2 latency: 10 samples, 2 warmup discarded |

Measurement details:
- Timer: `performance.now()` (monotonic, microsecond resolution)
- Stats: sample standard deviation (Bessel's correction, n-1)
- Warmup: 2 calls discarded before measurement begins

**Requires:** Supabase + Blockfrost connectivity, backend running
**Duration:** ~30-60 seconds

---

### `e2e-pipeline.test.js`

End-to-end pipeline: batch processing latency, on-chain verification, tamper detection, transaction fees.

Runs N batch cycles (default 5). Each cycle: seed pending readings -> POST /blockchain/batch -> wait for Cardano confirmation -> verify on-chain metadata -> tamper check -> cleanup.

| TC-ID | Metric |
|-------|--------|
| TC-BL-01 | Batch latency T3->T4 across N>=5 cycles |
| TC-BL-02 | On-chain label 674 merkleRoot matches local root |
| TC-BL-03 | Tamper detection: altered reading produces different root |
| TC-BL-04 | Transaction fee from Blockfrost API across N>=5 cycles |

**Requires:** Backend running, Supabase + Blockfrost Preprod connectivity
**Duration:** ~10-15 minutes (Cardano confirmation polling ~60-120s per cycle)
**Cost:** ~0.18 tADA per cycle (~0.9 tADA for 5 cycles)

Override cycle count:

```bash
E2E_BATCH_COUNT=3 node tests/e2e-pipeline.test.js
```

## Output

Every test writes structured JSON to `tests/results/`:

```
tests/results/
  merkle-tree_2026-04-25T10-30-00-000Z.json
  anomaly-detection_2026-04-25T10-31-00-000Z.json
  ingestion-latency_2026-04-25T10-32-00-000Z.json
  e2e-pipeline_2026-04-25T10-45-00-000Z.json
```

Each file contains:
- `runId` and `timestamp`
- Per-test results with TC-ID, pass/fail, detail, duration
- Raw measurements (samples, per-cycle details)
- Computed stats (mean, sd, min, max, n)
- For anomaly: full `f1Details[]` array with every reading's input, expected label, predicted label, reason, and z-score

## Safety

- **Preprod guard:** `ingestion-latency.test.js` and `e2e-pipeline.test.js` refuse to run if `BLOCKFROST_PROJECT_ID` does not start with `"preprod"`.
- **Test isolation:** All tests use timestamped household IDs (e.g., `ANOMALY_1776248248604_MAIN`) to avoid collision with production data.
- **Cleanup:** Test readings are deleted in `finally` blocks. Cardano transactions are permanent on Preprod (no real value).
- **No secrets in code:** All API keys read from `.env`.

