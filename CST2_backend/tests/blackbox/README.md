# SolarTrust Black Box Testing Suite

This folder contains the defense-ready black box test suite for Chapter 3.7.1 of the SolarTrust thesis. Tests exercise SolarTrust through public HTTP behavior only: request input, response output, latency, and externally observable status. They do not import backend implementation modules.

## Running

Start the backend first:

```bash
npm start
```

Then run the suite:

```bash
cd CST2_backend
npm run test:blackbox
```

Or use the runner:

```bash
bash tests/blackbox/run-all.sh
```

Configuration:

| Variable | Default | Purpose |
|---|---|---|
| `BLACKBOX_BASE_URL` | `http://127.0.0.1:3000` | Local or staged backend under test |
| `BLACKBOX_LIVE_BASE_URL` | unset | Render backend URL for e2e tests |
| `RENDER_BACKEND_URL` | unset | Fallback Render backend URL |
| `BLACKBOX_TEST_HOUSEHOLD_ID` | `blackbox-household-001` | Isolated test household |
| `BLACKBOX_TEST_PLANT_ID` | `TTC60011` | Taneko plant ID |
| `BLACKBOX_MAX_CAPACITY_WATTS` | `10000` | Boundary test maximum |
| `BLACKBOX_MAX_DRIFT_MS` | `300000` | Timestamp drift boundary |

The consolidated HTML report is written to:

```text
tests/blackbox/reports/blackbox-report.html
```

## Chapter 3.7.1 Mapping

Chapter 3.7.1 defines black box testing as requirement-conformance validation from the user/system boundary. This suite follows that method by treating SolarTrust as an opaque system and validating only the observable outcomes of submitted readings, reward requests, game sessions, dashboard queries, blockchain batching requests, and security probes.

| Methodology Item | Implementation |
|---|---|
| Input/output validation | Jest + Supertest sends HTTP payloads and checks status/body contracts |
| Equivalence partitioning | Normal vs anomalous readings, valid vs invalid wattage, valid vs tampered tokens |
| Boundary value analysis | `0`, `MAX_CAPACITY`, `-1`, `MAX_CAPACITY + 1`, timestamp drift, single/odd Merkle batches |
| Error guessing | SQL injection, timeout, tampering, duplicate submissions, secret leakage |
| Traceability | Every test includes TC ID and ISO 25010 attribute |
| Results documentation | HTML report and `test-results-template.md` are ready for Chapter 4 |

## ISO/IEC 25010 Coverage Matrix

| Test IDs | ISO/IEC 25010 Attribute | Validated Behavior |
|---|---|---|
| TC-FS-01 to TC-FS-07 | Functional suitability | Energy submission, reward calculation, Merkle root evidence, game completion, reward balances, anomaly detection |
| TC-REL-01 to TC-REL-05 | Reliability | Idempotency, graceful timeout behavior, DB failure handling, partial batch recovery, restart consistency |
| TC-PERF-01 to TC-PERF-04 | Performance efficiency | API sync, Merkle construction, dashboard fetch, reward computation timing |
| TC-SEC-01 to TC-SEC-06 | Security | Authentication, authorization, injection resistance, tamper detection, rate limiting, secret non-disclosure |
| TC-EDGE-01 to TC-EDGE-10 | Functional suitability and reliability | Boundary and edge-case behavior for readings, timestamps, batches, and reward weights |
| TC-E2E-01 to TC-E2E-03 | Portability, reliability, functional suitability | Live Render and Cardano Preprod smoke behavior |

## Four Algorithmic Layers

| Sir Pura Layer | Black Box Evidence |
|---|---|
| Z-Score Anomaly Detection | TC-FS-06, TC-FS-07 |
| Cryptographic Merkle Batching | TC-FS-03, TC-EDGE-06, TC-EDGE-07, TC-EDGE-08 |
| Blockchain Transaction Submission | TC-REL-02, TC-REL-04, TC-SEC-04, TC-E2E-02 |
| Dynamic Reward Computation | TC-FS-02, TC-FS-04, TC-FS-05, TC-PERF-04, TC-EDGE-09, TC-EDGE-10 |

## Sample Defense Q&A

**Why Black Box Testing instead of White Box?**

Black box testing validates whether SolarTrust satisfies thesis and user-facing requirements from the system boundary. It focuses on conformance, observable correctness, security responses, latency, and UAT-relevant behavior. It complements white box/unit testing because it does not depend on implementation details and can reveal integration defects that internal module tests may miss.

**How does this validate Sir Pura's four algorithmic layers?**

The suite maps each algorithmic layer to externally observable behavior. Z-score anomaly detection is validated by TC-FS-06 and TC-FS-07. Merkle batching is validated by TC-FS-03 and TC-EDGE-06 to TC-EDGE-08. Blockchain submission reliability and tamper handling are validated by TC-REL-02, TC-REL-04, TC-SEC-04, and TC-E2E-02. Dynamic reward computation is validated by TC-FS-02, TC-FS-04, TC-FS-05, TC-PERF-04, TC-EDGE-09, and TC-EDGE-10.

**What is the equivalence partitioning strategy?**

Solar wattage is partitioned into valid minimum, valid normal, valid maximum, negative invalid, and over-capacity invalid classes. Timestamps are partitioned into acceptable current readings and readings beyond maximum drift. Reward inputs are partitioned into normal baseline, zero baseline fallback, low network demand, and demand exceeding capacity. Security inputs are partitioned into absent token, tampered token, malicious plant ID, and repeated invalid login attempts.

## Reproducibility For Panel

1. Use a test Supabase project or a disposable household ID.
2. Start the backend with the thesis `.env` values.
3. Confirm `GET /test` returns HTTP 200.
4. Run `bash tests/blackbox/run-all.sh`.
5. Open `tests/blackbox/reports/blackbox-report.html`.
6. Copy relevant rows into `test-results-template.md` for Chapter 4.
7. For live validation, set `BLACKBOX_LIVE_BASE_URL` to the Render backend URL and rerun the suite.

## Notes

Some TC IDs intentionally represent thesis-required behavior that may not exist yet in the current API, such as `/auth/login`, `/rewards/:userId`, and `/game/complete`. Those tests are not skipped; a failure records a valid requirement gap for the defense results table.
