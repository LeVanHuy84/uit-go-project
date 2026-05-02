# K6 Load Test Report

## 1. Login Test

### Configuration

- Scenario: `capacity_test`
- Target: **500 iters/s**
- Duration: **1m50s**
- Max VUs: **132**
- Thresholds:
  - `p(95) < 400ms`
  - `http_req_failed < 0.001`

### Results

| Metric             | Value         |
| ------------------ | ------------- |
| Total Requests     | **29,914**    |
| Avg Latency        | **75.78 ms**  |
| Median             | **62.75 ms**  |
| p90                | **134.92 ms** |
| p95                | **170 ms**    |
| Max                | **542.9 ms**  |
| Error Rate         | **0%**        |
| Dropped Iterations | 85            |

---

## 2. Read Heavy Test – Get Profile

### Configuration

- Scenario: `read_heavy`
- Target: **500 iters/s**
- Duration: **1m50s**
- Max VUs: **205**
- Thresholds:
  - `p(95) < 200ms`
  - `http_req_failed < 1%`

### Results

| Metric             | Value         |
| ------------------ | ------------- |
| Total Requests     | **29,538**    |
| Avg Latency        | **29.33 ms**  |
| Median             | **5.95 ms**   |
| p90                | **81.65 ms**  |
| p95                | **110.34 ms** |
| Max                | **512.27 ms** |
| Error Rate         | **0%**        |
| Dropped Iterations | 161           |

---

## 3. Create Trip – API Only

### Configuration

- Scenario: `create_trip`
- Target: **500 iters/s**
- Duration: **1m20s**
- Max VUs: **200**
- Thresholds:
  - `p(95) < 500ms`
  - `http_req_failed < 1%`

### Results

| Metric         | Value        |
| -------------- | ------------ |
| Total Requests | **20,597**   |
| Avg Latency    | **8.57 ms**  |
| Median         | **6.42 ms**  |
| p90            | **11.3 ms**  |
| p95            | **19.46 ms** |
| Max            | **75.92 ms** |
| Error Rate     | **0%**       |

---

## 4. Create Trip – API + RabbitMQ (E2E Flow)

### Create Trip

#### Configuration

- Scenario: `create_trip`
- Target: **350 iters/s**
- Duration: **1m50s**
- Max VUs: **500**
- Thresholds:
  - `p(95) < 500ms`
  - `http_req_failed < 2%`

#### Results

- p95 = 243ms — đạt yêu cầu (< 500ms threshold)
- avg = 59ms, median = 29ms
- max = 377ms
- Error rate: 0%
- Dùng tới ~117 VUs (max 123)
- Dropped iterations: 23 (rất nhỏ, <0.2%)

### Driver listening + accept + complete trip

#### Result

===== SUMMARY =====

- assigned: 6655
- accepted: 6655
- completed: 6655
- requests: 13310
- failed: 0

### Ping location for 100 driver

#### Configuration

### Results

| Metric   | Value                  |
| -------- | ---------------------- |
| VUs      | `drivers.length = 100` |
| duration | 2m                     |

### TỔNG HỢP KẾT QUẢ 3 BÀI TEST

| Thành phần          | RPS / Throughput               | p95                  | Error | Kết luận              |
| ------------------- | ------------------------------ | -------------------- | ----- | --------------------- |
| **Trip Create API** | 350 RPS                        | 243ms                | 0%    | Tốt, chưa chạm ngưỡng |
| **Driver Workflow** | ~55 RPS assign+accept+complete | ≈ (gần như realtime) | 0%    | MQ + Logic ổn định    |
| **Update Location** | ~100 VUs (400 calls)           | 171ms                | 0%    | Redis stable          |
