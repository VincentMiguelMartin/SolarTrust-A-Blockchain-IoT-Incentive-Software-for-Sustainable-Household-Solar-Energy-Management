# SolarTrust Algorithm Performance Tests

Test suite for Chapter 3.7 thesis metrics. All results are written as structured JSON to `tests/results/`.

## Prerequisites

- Node.js 18+
- `CST2_backend/.env` with valid keys (Supabase, Blockfrost Preprod, Taneko)
- Supabase tables: `readings`, `blockchain_batches`, `households`
- For E2E/latency tests: backend running (`npm start` in another terminal)

## Quick Start

```bash
cd CST2_backend

# 1. Unit tests (no server needed)
node tests/merkle-tree.test.js
node tests/anomaly-detection.test.js

# 2. Ingestion latency (server must be running)
npm start &
node tests/ingestion-latency.test.js

# 3. E2E pipeline (server must be running, ~10-15 min, ~0.9 tADA)
node tests/e2e-pipeline.test.js
```

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

