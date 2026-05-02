# ARCHITECTURE.md

> Module A — Thiết kế Kiến trúc cho Scalability & Performance

---

## 1. Mục lục

1. [Tóm tắt](#tóm-tắt)
2. [Mục tiêu của module](#mục-tiêu-của-module)
3. [Kiến trúc tổng quan (Overview)](#kiến-trúc-tổng-quan-overview)
4. [Luồng nghiệp vụ quan trọng](#luồng-nghiệp-vụ-quan-trọng)
5. [Thiết kế chi tiết cho Module A](#thiết-kế-chi-tiết-cho-module-a)

   * Component diagram (Mermaid)
   * Data flows
   * Communication patterns (sync vs async)
6. [Các quyết định kiến trúc (ADR summary)](#các-quyết-định-kiến-trúc-adr-summary)
7. [Trade-offs phân tích (Consistency, Availability, Cost, Complexity)](#trade-offs-phân-tích-consistency-availability-cost-complexity)
8. [Kế hoạch kiểm chứng bằng Load Testing](#kế-hoạch-kiểm-chứng-bằng-load-testing)

   * Kịch bản k6
   * Mục tiêu & chỉ số đo lường (SLIs/SLOs)
9. [Tối ưu hoá & Tuning](#tối-ưu-hóa--tuning)

   * Caching
   * Auto-scaling
   * DB scaling
10. [Môi trường local (Docker Compose) — "bộ xương"](#môi-trường-local-docker-compose--bộ-xương)
11. [Hướng dẫn demo giữa kỳ (what to show)](#hướng-dẫn-demo-giữa-kỳ-what-to-show)
12. [Kế hoạch triển khai & timeline cho giai đoạn 2](#kế-hoạch-triển-khai--timeline-cho-giai-đoạn-2)
13. [Artifact cần nộp](#artifact-cần-nộp)
14. [Tham khảo & Tài liệu bổ sung](#tham-khảo--tài-liệu-bổ-sung)

---

## Tóm tắt

Báo cáo này trình bày kiến trúc hướng tới **scalability** và **performance** cho nền tảng UIT-Go. Phiên bản giữa kỳ (Cột mốc 1) tập trung vào việc:

* Cung cấp một "bộ xương" microservices chạy được trên **Docker Compose** (UserService, TripService, DriverService + DBs + Redis).
* Trình bày kiến trúc tổng quan và chi tiết cho Module A (thiết kế để đạt hyper-scale).
* Đưa ra các quyết định kiến trúc chính kèm phân tích trade-off.
* Lên kế hoạch kiểm chứng bằng **load testing** (k6) và chỉ ra các chiến lược tuning ban đầu.

---

## Mục tiêu của module

* Thiết kế kiến trúc có thể mở rộng đến mức hyper-scale (hàng triệu người dùng hoạt động đồng thời) thay vì chỉ tinh chỉnh.
* Bảo vệ các quyết định thiết kế với lập luận dựa trên trade-offs (ví dụ: Latency vs Cost, Consistency vs Availability).
* Kiểm chứng thực nghiệm bằng load tests và thực hiện tối ưu hóa dựa trên kết quả.

---

## Kiến trúc tổng quan (Overview)

Mô tả các thành phần cốt lõi của hệ thống ở mức logical:

* API Gateway (optionally)
* UserService (Auth, Profile) — DB: PostgreSQL
* TripService (Orchestration đặt chuyến) — DB: PostgreSQL
* DriverService (Position, Status) — In-memory/Redis Geo for location
* Message Bus / Queue (SQS/Kafka/Redis Stream) — cho các luồng bất đồng bộ
* Cache Layer (Redis ElastiCache)
* Observability: Metrics + Tracing (Prometheus + Grafana + Jaeger)

### Mermaid — High-level component diagram

```mermaid
flowchart LR
  subgraph Clients
    UA[User App]
    DA[Driver App]
  end

  UA -->|REST/gRPC| APIGW[API Gateway]
  DA -->|REST/gRPC| APIGW

  APIGW --> UserSvc[UserService]
  APIGW --> TripSvc[TripService]
  APIGW --> DriverSvc[DriverService]

  TripSvc -->|sync| DriverSvc
  TripSvc -->|async (queue)| EventBus[(Message Bus)]
  DriverSvc -->|publish| EventBus

  UserSvc --> UserDB[(Postgres - UserDB)]
  TripSvc --> TripDB[(Postgres - TripDB)]
  DriverSvc --> DriverDB[(Postgres or Redis for metadata)]

  DriverSvc -->|geo| RedisGeo[(Redis Geo)]
  EventBus -->|consume| WorkerPool[(Worker Pool - scaleable)]

  subgraph Observability
    TripSvc ---|metrics| Prometheus
    DriverSvc ---|traces| Jaeger
  end
```

---

## Luồng nghiệp vụ quan trọng

1. **Tìm kiếm tài xế (Find Drivers)**

   * Passenger -> TripService tạo request tìm tài xế.
   * TripService tìm tài xế gần bằng cách query Redis Geo. Nếu cần phức tạp hơn (filter vehicle-type, rating), kết hợp query lên DriverDB + cache.
   * TripService gửi notification (via WebSocket/Push) tới candidate drivers.

2. **Cập nhật vị trí tài xế (Driver Location Update)**

   * Driver app gửi vị trí định kỳ (e.g., every 2s).
   * DriverService cập nhật Redis Geo (fast writes); đồng bộ tỉ mỉ đến analytics DB (batch via EventBus) để tránh quá tải writes.

---

## Thiết kế chi tiết cho Module A

### Communication patterns

* **Sync for control-plane operations**: REST/gRPC cho những API cần phản hồi tức thì (e.g., login, trip creation acknowledgement).
* **Async for high-volume flows**: Message Queue (SQS/Kafka/Redis Stream) dùng cho events như "driver location bulk sync", "trip events", "billing".

**Lí do:** Async decouples high write-rate producers (driver position) from consumers (analytics, persistence), tránh làm sập core services. Trade-off: tăng độ trễ cho các hệ thống phụ thuộc, yêu cầu xử lý idempotency và ordering.

### Redis Geo vs DynamoDB+Geohash

* **Redis Geo (Speed-first)**: Latency thấp (sub-10ms), phù hợp cho tìm tài xế realtime. Hạn chế: RAM cost, dữ liệu volatile. Cần có backup/stream to persistent store.
* **DynamoDB + Geohash (Scale/Cost-first)**: Rẻ hơn cho writes ở quy mô lớn, tốt cho historic positions nhưng tìm kiếm bán kính phức tạp hơn và có độ trễ cao hơn.

**Quyết định sơ bộ:** Dùng Redis Geo cho tìm kiếm realtime trên "bộ xương" local; trong giai đoạn scale-up, thêm geohash index trên a scalable datastore và hybrid approach (Redis hot cache + long-term store).

---

## Các quyết định kiến trúc (ADR summary)

* ADR-001: **REST vs gRPC** — Chọn REST cho external client -> API Gateway (ease), gRPC cho service-to-service (low-latency internal RPC). Trade-off: gRPC tốt hơn latency but has higher operational complexity.

* ADR-002: **Redis Geo vs DynamoDB** — Chọn Redis Geo cho realtime during prototype. Plan migration path to DynamoDB/Scylla for geo-scale.

* ADR-003: **Sync vs Async between TripService & DriverService** — Default: Sync call for simple find/assign during prototype; plan to introduce async queue for surge scenarios.

(Full ADR files should be placed in `/ADR/` folder with context, decision, alternatives, consequences.)

---

## Trade-offs phân tích

* **Consistency vs Availability**: Vị trí tài xế có thể chấp nhận eventual consistency (Availability ưu tiên). Giá trị write-heavy nên cache-first và async writeback.
* **Latency vs Cost**: Redis giảm latency đáng kể nhưng tăng chi phí (RAM). Có thể optimize bằng tần suất cập nhật (throttle) và delta-compression.
* **Complexity vs Reliability**: Thêm Kafka/Redis Stream tăng độ phức tạp vận hành nhưng cải thiện khả năng chịu tải và decoupling.

---

## Kế hoạch kiểm chứng bằng Load Testing

### Mục tiêu kiểm chứng (Hypotheses)

1. Hệ thống hiện tại (bộ xương) chịu được X RPS của flow `CreateTrip -> FindDrivers` với p95 latency < 200ms.
2. Khi dùng async queue và caching, hệ thống chịu được >= 3x load với latency tăng chấp nhận được.

### Công cụ

* **k6** cho HTTP load test (scriptable, dễ tạo threshold)
* **Prometheus + Grafana** để thu thập metrics

### Kịch bản mẫu k6

* **Scenario A (normal traffic)**: 100 VUs, 5s ramp-up, mỗi VU tạo 1 trip request / 10s.
* **Scenario B (spike)**: sudden 500 concurrent users creating trip at same time.
* **Driver location stream**: simulate 5000 drivers sending location updates every 2s (this is heavy; push to Redis Geo).

### Chỉ số cần đo

* RPS (requests/s)
* Latency distribution (p50, p95, p99)
* Error rate
* CPU, Memory, Redis ops/sec, DB connections

### Ví dụ thresholds (gợi ý)

* p95(FindDriver) < 200ms
* Error rate < 0.1%
* System sustainable RPS target: start with 500 RPS for prototype

---

## Tối ưu hoá & Tuning (sau kiểm chứng)

1. **Caching**

   * Cache driver static meta (vehicle type, rating) in Redis or local L1 cache to reduce DB lookups.
   * Cache geospatial queries with short TTL.
2. **Auto Scaling**

   * Deploy services in ASG (EC2) or ECS/EKS with HPA based on CPU/RPS/Custom metrics (queue length).
3. **DB scaling**

   * Read replicas for Postgres (Offload read-heavy endpoints like trip history).
   * Partitioning/sharding for very large tables.
4. **Write optimization for driver positions**

   * Write to Redis directly for realtime; batch-stream to persistent DB via worker to reduce IO.
   * Consider protocol buffers over binary sockets for driver app to reduce payload.

---

## Môi trường local (Docker Compose) — "bộ xương"

### Thành phần đề xuất trong `docker-compose.yml`

* user-service (container)
* trip-service (container)
* driver-service (container)
* postgres-user
* postgres-trip
* redis (for geo)
* api-gateway (optional)
* prometheus + grafana (optional)

### Lưu ý network

* Dùng service names để liên lạc (`http://driver-service:8080`)

### Script demo

* `scripts/demo_flow.sh` (curl sequence):

  1. POST /users -> create user
  2. POST /sessions -> login
  3. POST /trips -> create trip
  4. GET /drivers/search?lat=..&lng=.. -> show candidates

---

## Hướng dẫn demo giữa kỳ (what to show)

1. **Chạy Docker Compose**: `docker-compose up --build`
2. **Chạy demo script**: `scripts/demo_flow.sh` hoặc Postman collection
3. **Minimally show**:

   * UserService tạo user
   * UserService gọi TripService để tạo trip
   * TripService gọi DriverService (search) và nhận list drivers
4. **Show architecture doc** (this file): highlight decisions
5. **Show plan for module**: load testing plan, ADR list

---

## Kế hoạch triển khai & timeline cho giai đoạn 2 (gợi ý)

* Week 9: Implement async queue between TripService & DriverService (Redis Stream or Kafka)
* Week 10: Build k6 scenarios and run baseline tests
* Week 11: Apply caching & auto-scaling; run optimized tests
* Week 12: Collect results, produce REPORT.md (with graphs before/after)

---

## Artifact cần nộp (giữa kỳ)

* `ARCHITECTURE.md` (this file)
* `docker-compose.yml` + service Dockerfiles
* README with run instructions
* ADR/ (at least 2 ADRs)
* Minimal Postman collection / demo script

---

## Tham khảo & Tài liệu bổ sung

* Redis Geo: [https://redis.io/docs/manual/data-types/geo/](https://redis.io/docs/manual/data-types/geo/)
* k6: [https://k6.io/docs/](https://k6.io/docs/)
* AWS SQS vs Kafka: articles & official docs

---

> **Ghi chú:** Hãy copy thêm các ADR chi tiết vào thư mục `ADR/` (mỗi ADR là 1 file markdown theo template: Title, Status, Context, Decision, Consequences, Alternatives). Cần ít nhất 2 ADRs cho giữa kỳ: 1) redis-vs-dynamodb; 2) rest-vs-grpc.
