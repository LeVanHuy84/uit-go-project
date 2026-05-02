# ADR-0001 — Giải thích chi tiết: Vì sao chọn **PostgreSQL** cho UserService & phù hợp với *Module A: Scalability & Performance*

**Ngày:** 2025-10-28  
**Trạng thái:** Accepted ✅  
**Tác giả:** Nguyễn Đình Huy

---

## 1. Tóm tắt ngắn gọn
Chọn **PostgreSQL** vì nó cung cấp **ACID**, MVCC, hướng mở rộng theo chiều ngang/chiều dọc với nhiều công cụ hỗ trợ (replica, logical replication, sharding bằng Citus), có khả năng lưu cả dữ liệu quan hệ lẫn JSON (JSONB) để xử lý các trường hợp bán cấu trúc.  
Điều này giúp UserService vừa đảm bảo **tính nhất quán dữ liệu** (critical với thông tin người dùng, session, quyền), vừa dễ mở rộng khi cần (read replicas, partitioning, external sharding), phù hợp với mục tiêu của *Module A* (thiết kế cho hyper-scale).

---

## 2. Lý do kỹ thuật chi tiết

### 2.1. Tính toàn vẹn dữ liệu & ACID
- PostgreSQL là RDBMS chuẩn ACID, đảm bảo **consistency** cho các thao tác quan trọng như đăng ký, thay đổi quyền, liên kết user ↔ vehicle.  
- MVCC (Multi-Version Concurrency Control) giúp concurrency cao, giảm lock contention.

### 2.2. Khả năng truy vấn phức tạp & phong phú
- Hỗ trợ SQL đầy đủ: joins, window functions, CTEs — hữu ích cho truy vấn 1–n, báo cáo, audit.  
- Indexing mạnh mẽ: B-tree, GiST, GIN, BRIN cho nhiều kiểu dữ liệu (text, JSON, array, time-series).

### 2.3. Hỗ trợ dữ liệu bán cấu trúc (JSONB)
- Cho phép lưu metadata/profile linh hoạt mà vẫn **index được bằng GIN**.  
- Dễ kết hợp với schema quan hệ trong cùng một hệ thống.

### 2.4. Tính mở rộng (Scalability)
- **Read scaling:** dễ thêm read replicas (Hot Standby) để chia tải đọc.  
- **Write scaling:** có thể dùng:
  - **Logical replication + sharding theo region hoặc user_id.**
  - **Citus** extension để scale-out dữ liệu theo node.
  - **CQRS/Event Sourcing** để tách tải ghi và đọc.

### 2.5. Reliability & vận hành
- WAL (Write-Ahead Logging), PITR (Point-in-Time Recovery), base backup.  
- Hệ sinh thái extension mạnh: `pg_trgm`, `citus`, `pg_partman`, `postgis`...  
- Hỗ trợ CDC (Change Data Capture) và giám sát dễ dàng (Prometheus exporter).

---

## 3. Áp dụng cho *Module A — Scalability & Performance*

### 3.1. Trade-offs chính
| Tiêu chí | Lựa chọn | Ưu điểm | Đánh đổi |
|----------|-----------|----------|-----------|
| **Consistency vs Availability** | PostgreSQL single-writer | Giữ ACID, tránh xung đột | Giới hạn write throughput |
| **Cost vs Performance** | Read replicas + cache | Giảm tải DB chính | Cần đồng bộ hóa dữ liệu |
| **Latency vs Durability** | Async replication | Nhanh hơn | Có thể mất dữ liệu nếu crash |
| **Complexity vs Scalability** | Citus / sharding | Scale lớn | Tăng độ phức tạp vận hành |

### 3.2. Kiến trúc đề xuất
``` markdown
            ┌─────────────────────────┐
            │        API Gateway      │
            └────────────┬────────────┘
                         │
            ┌────────────▼────────────┐
            │       UserService       │
            └────────────┬────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
┌────────▼──────┐ ┌───────▼────────┐ ┌──────▼────────┐
│ pgBouncer     │ │ Read Replica 1 │ │ Read Replica 2│
│(Pooling Layer)│ │ (Reporting)    │ │ (Search)      │
└────────┬──────┘ └────────────────┘ └───────────────┘
│
┌────────▼────────┐
│ PostgreSQL DB   │
│ (Primary Node)  │
└─────────────────┘
```


### 3.3. Schema & Data Modelling
- Dùng `UUID` cho ID để dễ sharding.  
- Partition theo `created_at` hoặc `region`.  
- Normalize transactional data (User, Vehicle).  
- Denormalize bảng đọc-heavy (profile_summary).  
- Dữ liệu linh hoạt → dùng JSONB với GIN index.

### 3.4. Load Testing Scenarios (K6 / JMeter)
| Kịch bản | Mục tiêu | Metric theo dõi |
|----------|-----------|----------------|
| **Spike test** (5x request surge khi đặt xe) | Kiểm tra latency & connection saturation | p95 latency, DB CPU |
| **Read-heavy test** (10k RPS đọc profile) | Đánh giá hiệu quả read replicas | replication lag, cache hit ratio |
| **Write-heavy test** (2k RPS cập nhật session) | Đo WAL throughput & I/O wait | write latency, autovacuum stats |

---

## 4. Tối ưu vận hành (Operational Tuning)

### 4.1. Connection & Pooling
- Dùng **pgBouncer** transaction pooling.  
- `max_connections`: ~100, pooler handle concurrency.  

### 4.2. Autovacuum & Bloat
- Tối ưu `autovacuum_vacuum_scale_factor = 0.1`.  
- Dùng `pg_repack` giảm bloat định kỳ.

### 4.3. WAL & Replication
- `wal_level = replica` hoặc `logical` (nếu cần CDC).  
- Replication async cho performance, sync cho critical path.

### 4.4. Index Strategy
- Dùng `EXPLAIN ANALYZE` kiểm chứng.  
- Partial index cho `WHERE active = true`.  
- BRIN index cho bảng theo thời gian (`created_at`).

### 4.5. Backup & DR
- PITR backup (WAL archiving).  
- Kiểm thử recovery định kỳ.

---

## 5. Checklist triển khai
1. Thiết kế schema: normalize transactional, denormalize read-heavy.  
2. Dùng UUID cho key, index phù hợp.  
3. Thiết lập **pgBouncer** + connection pooling.  
4. Cấu hình **read replicas** cho tải đọc.  
5. Thêm **Redis cache** cho session/profile.  
6. Theo dõi với **Prometheus + Grafana**.  
7. Chạy **load test baseline** với k6.  
8. Tune index, partition, autovacuum.  
9. Khi write bottleneck: xem xét **Citus / sharding / CQRS**.

---

## 7. Alternatives Considered

### 7.1. MySQL / MariaDB

**Lý do cân nhắc:**
- Phổ biến, dễ vận hành, có cơ chế replication ổn định.

**Lý do loại bỏ:**
- Hạn chế về hỗ trợ JSON indexing (không có JSONB).  
- MVCC yếu hơn, dễ xảy ra lock contention trong môi trường ghi nhiều.  
- Khả năng partitioning và sharding kém linh hoạt hơn PostgreSQL.  
- Một số tính năng nâng cao như CTE, window function, partial index chưa mạnh.

**Kết luận:**  
→ Phù hợp cho hệ thống transactional nhỏ, nhưng không đủ cho workload kết hợp structured + semi-structured và cần scale lớn.

---

### 7.2. MongoDB

**Lý do cân nhắc:**
- Linh hoạt về schema, phù hợp cho metadata và hồ sơ người dùng dạng JSON.

**Lý do loại bỏ:**
- Thiếu ACID transaction đa tài liệu (multi-document) ở các phiên bản cũ.  
- Consistency yếu hơn, khó enforce foreign key logic.  
- Khó thực hiện join hoặc report phức tạp.  
- Dễ phát sinh data duplication và write amplification khi quy mô lớn.

**Kết luận:**  
→ Thích hợp làm service phụ trợ lưu metadata, nhưng không phù hợp làm main store cho UserService cần đảm bảo consistency cao.

---

### 7.3. CockroachDB

**Lý do cân nhắc:**
- Có khả năng scale-out tự nhiên, tương thích PostgreSQL, hỗ trợ distributed transaction.

**Lý do loại bỏ:**
- Chi phí vận hành và tuning cao.  
- Mức độ mature thấp hơn PostgreSQL, ít công cụ hỗ trợ.  
- Một số extension PostgreSQL chưa tương thích hoàn toàn.

**Kết luận:**  
→ Tiềm năng trong tương lai khi cần multi-region write, nhưng hiện tại PostgreSQL ổn định và tối ưu chi phí hơn.

---

### 7.4. NoSQL khác (DynamoDB, Cassandra)

**Lý do cân nhắc:**
- Khả năng scale-out dễ, độ sẵn sàng cao (high availability).

**Lý do loại bỏ:**
- Không hỗ trợ ACID transaction đầy đủ.  
- Mô hình dữ liệu key-value, khó truy vấn join/report.  
- Migration phức tạp khi cần query linh hoạt.

**Kết luận:**  
→ Phù hợp cho caching hoặc event log, không phù hợp làm transactional database chính của UserService.

---

## 8. Security Considerations

### 8.1. Kết nối & Mã hóa
- Bật SSL/TLS giữa ứng dụng và database để chống sniffing.  
- Sử dụng client certificates cho kết nối nội bộ hoặc IAM-based auth trên cloud.  
- Mã hóa dữ liệu at rest bằng TDE hoặc giải pháp KMS (AWS, GCP, Azure).

### 8.2. Quản lý tài khoản & phân quyền
- Mỗi microservice có database role riêng, chỉ truy cập schema của mình.  
- Tránh sử dụng tài khoản superuser (postgres) trong production.  
- Áp dụng Principle of Least Privilege (PoLP) trong mọi truy cập.

### 8.3. Bảo vệ dữ liệu người dùng
- Mã hóa hoặc hash các trường nhạy cảm: password, email, phone, token.  
- Dùng bcrypt cho mật khẩu.  
- Ghi lại audit log cho các hành động thay đổi dữ liệu người dùng.

### 8.4. Ngăn ngừa SQL Injection & Data Leak
- Sử dụng ORM (Prisma) để ngăn injection.  
- Hạn chế logging dữ liệu PII trong query logs.  
- Thiết lập read-only cho replicas để tránh ghi nhầm dữ liệu.

### 8.5. Backup & Key Management
- Tất cả backup phải được mã hóa (AES-256 hoặc cloud-managed key).  
- Quản lý khóa mã hóa bằng KMS riêng biệt với dữ liệu.  
- Định kỳ thực hiện restore test để đảm bảo khả năng khôi phục.

## 9. Kết luận
PostgreSQL mang lại nền tảng **ổn định, ACID, mạnh mẽ và linh hoạt** cho UserService:  
- Dễ mở rộng qua read replicas, partitioning, Citus.  
- Dễ tối ưu hiệu năng nhờ connection pooling, caching, CQRS.  
- Dễ kiểm soát và quan sát (monitoring, backup, recovery).  

Nó cân bằng giữa **hiệu năng và tính toàn vẹn dữ liệu**, hoàn toàn phù hợp để phát triển *Module A – Scalability & Performance* hướng tới hệ thống **hyper-scale** mà vẫn giữ **consistency** và **stability** cho các nghiệp vụ lõi.