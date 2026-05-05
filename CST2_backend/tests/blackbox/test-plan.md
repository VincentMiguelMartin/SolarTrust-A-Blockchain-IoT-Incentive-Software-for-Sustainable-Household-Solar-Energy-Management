# SolarTrust Black Box Test Plan

## Strategy

This suite validates SolarTrust as an opaque system using HTTP inputs and observable HTTP/database-facing outputs only. The tests do not import backend services, anomaly detection modules, reward modules, Merkle utilities, or blockchain submission code. External Taneko and Blockfrost dependencies are treated as replaceable test doubles for deterministic black box execution.

## Scope

In scope:
- Energy reading submission and synchronization endpoints.
- Reward calculation and accumulated reward retrieval.
- Game completion/session reward behavior.
- Merkle batching and blockchain submission behavior through public API responses.
- Security, reliability, performance, boundary, and error handling behavior.
- Live end-to-end smoke tests against the hosted Render backend and Cardano Preprod when environment variables are provided.

Out of scope:
- Direct inspection of internal implementation branches.
- White box unit tests against `validateEnergy.js`, `diagnostics.js`, Merkle helpers, Lucid transaction builders, or reward formula modules.
- Manual Supabase table mutation outside public application workflows.

## ISO/IEC 25010 Mapping

| ISO/IEC 25010 Characteristic | Black Box Focus | Test Files |
|---|---|---|
| Functional suitability | Correct API outputs for readings, rewards, Merkle commitments, anomaly decisions, and game completion | `functional-suitability.test.js` |
| Reliability | Idempotency, timeout handling, data preservation, recovery after partial failures and restart | `reliability.test.js` |
| Performance efficiency | Latency and execution time under thesis-defined thresholds | `performance-efficiency.test.js` |
| Security | Authentication, authorization, injection resistance, tamper detection, rate limiting, secret non-disclosure | `security.test.js` |
| Compatibility | API behavior remains usable by Expo mobile clients through stable JSON contracts | Covered through functional and e2e API contracts |
| Usability | User-facing flows return actionable success/error states for UAT and TAM perceived usefulness | Covered through functional and security outputs |
| Maintainability | Traceable, repeatable test IDs and documented expected outcomes | All files and result template |
| Portability | Tests run locally or against Render by changing `BLACKBOX_BASE_URL` | `run-all.sh`, `e2e/` |

## Test Environment

Local deterministic mode:
- Backend: local Express server at `BLACKBOX_BASE_URL`, default `http://127.0.0.1:3000`.
- Database: Supabase test project or isolated test household IDs.
- Taneko: mock endpoint through `TANEKO_BASE_URL` where supported by the running backend.
- Blockfrost/Cardano: mock Blockfrost endpoint where supported by the running backend.
- Test runner: Jest + Supertest + nock + jest-html-reporter.

Live e2e mode:
- Backend: Render URL from `BLACKBOX_LIVE_BASE_URL` or `RENDER_BACKEND_URL`.
- Blockchain: Cardano Preprod through Blockfrost.
- Metadata label: 674.
- IoT plant ID: `TTC60011`.

## Techniques

| Technique | Applied To |
|---|---|
| Equivalence partitioning | Valid/invalid `solarWatts`, valid/invalid timestamps, normal/anomalous energy readings, reward inputs |
| Boundary value analysis | `0`, `MAX_CAPACITY`, `-1`, `MAX_CAPACITY + 1`, timestamp drift limit, single and odd batch sizes |
| Error guessing | SQL injection, tampered JWT, timeout, Supabase failure, Blockfrost failure, secret leakage |

## Entry Criteria

- Backend is running and reachable at `BLACKBOX_BASE_URL`.
- Test `.env` uses non-production Supabase data or test household IDs.
- Jest, Supertest, nock, and jest-html-reporter are installed.
- Required public endpoints are documented or known.

## Exit Criteria

- All implemented public API requirements pass, or failing test IDs are recorded as defects.
- `tests/blackbox/reports/blackbox-report.html` is generated.
- Results are transferred to `test-results-template.md` for Chapter 4 reporting.
- Security failures are triaged before APK or defense demonstration.
