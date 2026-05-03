# Load Test Report

# full-flow-1777804931841.json

| Scenario | Requests | avg(ms) | p95(ms) | errors | checks passed | checks failed |
|---|---:|---:|---:|---:|---:|---:|
| normal | 2763 | 21.92 | 56.18 | 0 | 2763 | 0 |
| stress | 38809 | 45.23 | 90.20 | 2 | 38807 | 2 |
| spike | 6124 | 34.90 | 65.57 | 2 | 6122 | 2 |
| soak | 50549 | 29.32 | 71.00 | 3 | 50546 | 3 |

# ping-location-1777804931841.json

| Scenario | Requests | avg(ms) | p95(ms) | errors | checks passed | checks failed |
|---|---:|---:|---:|---:|---:|---:|
| default | 1050 | 6.05 | 36.43 | 0 | 1050 | 0 |

# smoke-normal-1777804883052.json

| Scenario | Requests | avg(ms) | p95(ms) | errors | checks passed | checks failed |
|---|---:|---:|---:|---:|---:|---:|
| normal | 256 | 15.23 | 56.55 | 0 | 256 | 0 |

## Recommendations
- Review p95 latency differences between scenarios.
- Compare spike/stress behavior against CPU and memory metrics in Grafana.