# Full-Flow Distributed Load Testing for Ride-Sharing System

This directory contains a complete load-testing orchestration for the UIT GO ride-sharing microservices.

## Quick Start

From the **project root directory**:

```bash
npm run load:test
```

Or from the **scripts directory**:

```bash
npm run load:test
```

## What Happens

The orchestrator (`run-full-load-test.js`) performs these steps automatically:

1. **Preload Users & Drivers**: Generates auth tokens via `passenger-preload.js` and `driver-preload.js`
   - Outputs: `k6/csv/users_with_token.csv`, `k6/csv/driver_with_all.csv`

2. **Start Background Services** (detached):
   - `ping-location.js`: Simulates drivers sending GPS pings every 30s
   - `driver-listener.js`: Simulates driver listening to RabbitMQ assignments and accepting/completing trips

3. **Run Main Scenario** (`full-flow.js`):
   - Tests passenger trip creation with 4 scenarios:
     - **Normal Load**: Steady 50 VUs for 2 minutes (SLO verification)
     - **Stress**: Ramp from 10 → 200 VUs over 6 minutes (degradation analysis)
     - **Spike**: Burst to 300 requests/sec instantly (resilience test)
     - **Soak**: 60 VUs for 30 minutes (leak detection)

4. **Collect Results**: All k6 runs output JSON metrics to `results/`

5. **Analyze Results**: Generates:
   - `results/summary.csv`: Aggregated metrics table
   - `reports/report.md`: Markdown report with recommendations

## Environment Variables

Override default test parameters:

```bash
# Normal scenario: 100 VUs for 5 minutes
NORMAL_VUS=100 NORMAL_DURATION=5m npm run load:test

# Background services durations
PING_VUS=30 PING_DURATION=5m LISTENER_VUS=10 LISTENER_DURATION=5m npm run load:test
```

## Key Metrics to Monitor

### In k6 Output

- **http_req_duration**: Latency of HTTP requests (track p95/p99)
- **trip_create_latency_ms**: Custom metric for trip endpoint
- **trip_create_success**: Success rate (counter)
- **errors_total**: Total errors

### In Prometheus (Grafana dashboard)

- **service CPU & memory**: Identify CPU-bound bottlenecks
- **postgres_queries_total**: DB query rate
- **rabbitmq_messages_published_total**: Message throughput
- **redis_commands_processed_total**: Cache hit/miss
- **http_requests_in_flight**: Queue depth

## Reading Results

### results/summary.csv

```
file,total_requests,avg_req_duration,p95,errors,checks_passed,checks_failed
full-flow-1234.json,15000,125,450,12,14988,12
```

**Analysis:**

- **avg_req_duration < 150ms**: Good baseline
- **p95 > 500ms**: Indicates queueing or resource contention
- **errors > 1%**: Service degradation (check logs for timeouts, connection pools)

### reports/report.md

Markdown table with per-scenario metrics. Use this as a starting point.

## Expected Baseline Performance

Based on current resource limits:

| Metric                                | Expected   | Notes                                                        |
| ------------------------------------- | ---------- | ------------------------------------------------------------ |
| Stable RPS (normal load)              | 25–60      | Conservative for current DB + service CPU caps               |
| Peak RPS (before degradation)         | 80–140     | Above this, queueing and error growth are expected           |
| p95 latency (stable)                  | 150–400ms  | Typical when system is below saturation                      |
| p95 latency (stressed)                | 700ms–1.8s | Postgres and RabbitMQ contention dominates                   |
| Active pinging drivers (30s interval) | 150–500    | Drivers actively sending GPS updates                         |
| Simultaneous active trips             | 60–180     | Trip create + assignment + state updates with current limits |

Notes:

- Do not confuse "online registered drivers" with "actively pinging drivers". The first can be much higher, but active GPS updates and trip-state writes are what consume backend capacity.
- With current limits (many services at 0.5-0.7 CPU and 400MB), trip throughput is usually constrained by Postgres write path and queue processing before app-layer HTTP becomes the bottleneck.

## Bottleneck Identification

Watch for these correlation patterns in Prometheus:

1. **If CPU (services) < 50% but p95 latency grows**:
   - → Bottleneck: Database (lock contention, slow queries)
   - **Fix**: Index optimization, connection pool tuning, or increase Postgres CPU

2. **If CPU (services) pinned at 80–100% with growing latency**:
   - → Bottleneck: Node event loop saturation
   - **Fix**: Scale service instances, or optimize hot code paths (profiling)

3. **If RabbitMQ queue depth grows unbounded**:
   - → Bottleneck: Consumer throughput (driver-service)
   - **Fix**: Increase driver-service instances or consumer concurrency

4. **If Redis latency grows with trip volume**:
   - → Bottleneck: Session/cache layer
   - **Fix**: Increase Redis memory or tune eviction policy

## Portfolio Presentation

### What to include in your CV

1. **System Architecture Diagram**: Services, DBs, messaging, load balancers
2. **Load Test Results Table**: Normal/Stress/Spike/Soak with RPS, p95, error%
3. **Bottleneck Analysis**: "Postgres writes are the primary constraint at 140 RPS due to..."
4. **Optimization Roadmap**: "To reach 500 RPS stable, we need: (1) DB indexing, (2) connection pooling, (3) scale to 3 instances"
5. **GitHub/Portfolio Link**: Link to this repo with load test scripts

### Example narrative

> "I built a distributed load-testing framework for a 7-microservice ride-sharing system using k6. The orchestrator automatically preloads test data, starts background simulators (GPS pings, message listeners), runs realistic trip-creation scenarios (normal/stress/spike/soak), and generates performance reports. Identified PostgreSQL as the primary bottleneck at 140 RPS stable throughput. Recommended indexing and connection pooling as next steps to reach 500+ RPS."

## Troubleshooting

### `'k6' not recognized`

- **Cause**: k6 not installed globally
- **Fix**: Use `docker compose` (already configured) or install k6 locally

### `Connection refused to gateway-lb`

- **Cause**: Services not running
- **Fix**: Run `docker compose up` first (in project root)

### `CSV not found: ./k6/csv/users.csv`

- **Cause**: Preload data missing
- **Fix**: Ensure `users.csv` and `driver.csv` exist in `scripts/k6/csv/`

### Preload hangs on login

- **Cause**: Backend not responding or rate-limited
- **Fix**: Check that `http://localhost:4000` is accessible; see preload script BE_URL

### Background services not starting (ping/listener)

- **Cause**: Docker network issue or docker-compose.yml in wrong location
- **Fix**: Ensure `scripts/docker-compose.yml` exists and external network is created

## Advanced Usage

### Run only specific scenario

```bash
cd scripts
docker compose run --rm k6 run --out json=results/custom.json full-flow.js
```

### Run only preloads (no test)

```bash
node scripts/k6/passenger-preload.js
node scripts/k6/driver-preload.js
```

### Run individual services manually

```bash
cd scripts

# Ping location simulator
npm run ping

# Driver listener
npm run lis

# Trip creation
npm run trip
```

## Files

- **full-flow.js**: Main k6 test with 4 scenarios (normal/stress/spike/soak)
- **run-full-load-test.js**: Orchestrator (preload → background services → test → analyze)
- **run-full-load-test.sh / .ps1**: Shell/PowerShell wrappers
- **analyze-results.js**: Parses k6 JSON outputs into CSV + Markdown report
- **lib/utils.js, lib/metrics.js**: Lightweight helpers (reusable)
- **results/**: Output directory (k6 JSON files)
- **reports/**: Generated markdown reports

## Next Steps

1. **Run the test**: `npm run load:test` from repo root
2. **Check results**: `cat results/summary.csv` and `cat reports/report.md`
3. **Correlate with Prometheus**: Open Grafana at http://localhost:3000
4. **Identify bottleneck**: Overlay k6 RPS + p95 with service CPU/Postgres metrics
5. **Optimize**: Index DB, tune connection pools, scale services
6. **Re-test**: Re-run and verify improvements
