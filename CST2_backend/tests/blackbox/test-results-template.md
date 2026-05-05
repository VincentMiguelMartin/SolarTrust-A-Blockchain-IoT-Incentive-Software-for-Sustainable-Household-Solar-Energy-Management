# Black Box Test Results Template

| Test ID | ISO 25010 Attribute | Description | Input | Expected Output | Actual Output | Status (Pass/Fail) | Notes/Defects |
|---|---|---|---|---|---|---|---|
| TC-FS-01 | Functional suitability | Valid energy reading submission | Valid household, timestamp, solar/grid watts | 200/201, stored reading, PENDING status |  |  |  |
| TC-FS-02 | Functional suitability | Reward computation correctness | Known reward inputs | Positive reward and expected weight breakdown |  |  |  |
| TC-FS-03 | Functional suitability | Merkle root regeneration | Batchable readings | Stored/on-chain root matches regenerated root |  |  |  |
| TC-FS-04 | Functional suitability | Game completion reward update | Completed game payload | Rewards updated |  |  |  |
| TC-FS-05 | Functional suitability | Accumulated reward balance | User/household ID | Correct total balance |  |  |  |
| TC-FS-06 | Functional suitability | Z-score anomaly rejection | Extreme reading | Flagged/rejected anomaly |  |  |  |
| TC-FS-07 | Functional suitability | Normal reading acceptance | Within normal range | Accepted reading |  |  |  |
| TC-REL-01 | Reliability | Idempotent duplicate submission | Same reading twice | Duplicate not double-counted |  |  |  |
| TC-REL-02 | Reliability | Blockfrost timeout recovery | Blockchain submission under timeout | Retry/backoff or queued response |  |  |  |
| TC-REL-03 | Reliability | Supabase failure behavior | Reading during DB failure | Queued/no data loss response |  |  |  |
| TC-REL-04 | Reliability | Partial batch recovery | Consecutive batch cycles | Orphaned readings recovered |  |  |  |
| TC-REL-05 | Reliability | Restart mid-batch recovery | State before/after restart | State remains consistent |  |  |  |
| TC-PERF-01 | Performance efficiency | `/energy/sync` p95 latency | Five sync requests | p95 <= 500ms |  |  |  |
| TC-PERF-02 | Performance efficiency | 100-reading Merkle construction | 100 readings | <= 200ms |  |  |  |
| TC-PERF-03 | Performance efficiency | Dashboard fetch latency | Dashboard request | <= 1000ms |  |  |  |
| TC-PERF-04 | Performance efficiency | Reward computation latency | Reward request | <= 50ms |  |  |  |
| TC-SEC-01 | Security | Unauthenticated rewards access | No token | 401 |  |  |  |
| TC-SEC-02 | Security | SQL injection rejection | Malicious plantId | 400/401/403/404/422, no leakage |  |  |  |
| TC-SEC-03 | Security | Tampered JWT rejection | Invalid token | 403 |  |  |  |
| TC-SEC-04 | Security | Merkle tamper detection | Modified reading/root | 400/409/422 mismatch |  |  |  |
| TC-SEC-05 | Security | Login rate limiting | Repeated invalid login | 429 |  |  |  |
| TC-SEC-06 | Security | Secret non-disclosure | Error-triggering request | No secrets in response |  |  |  |
| TC-EDGE-01 | Functional suitability | Minimum solar watts | `solarWatts = 0` | Accepted |  |  |  |
| TC-EDGE-02 | Functional suitability | Maximum solar watts | `solarWatts = MAX_CAPACITY` | Accepted |  |  |  |
| TC-EDGE-03 | Functional suitability | Negative solar watts | `solarWatts = -1` | Rejected |  |  |  |
| TC-EDGE-04 | Functional suitability | Over-capacity solar watts | `MAX_CAPACITY + 1` | Rejected |  |  |  |
| TC-EDGE-05 | Reliability | Timestamp drift | Drift greater than max | Rejected |  |  |  |
| TC-EDGE-06 | Reliability | Empty batch | No pending readings | No transaction submitted |  |  |  |
| TC-EDGE-07 | Functional suitability | Single-reading Merkle batch | One reading | Leaf duplication root |  |  |  |
| TC-EDGE-08 | Functional suitability | Odd-reading Merkle batch | Three readings | Last leaf duplication root |  |  |  |
| TC-EDGE-09 | Functional suitability | Zero baseline reward fallback | baseline = 0 | `W_behavior = 1.0` |  |  |  |
| TC-EDGE-10 | Functional suitability | Network demand clamp | Demand > capacity | `W_network = 0.5` |  |  |  |
