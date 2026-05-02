# ADR-0002: Sử dụng PostgreSQL cho TripService

**Ngày:** 2025-10-28
**Trạng thái:** Accepted ✅
**Tác giả:** Quách Vĩnh Cơ

---

## 1. Ngữ cảnh

`TripService` chịu trách nhiệm quản lý toàn bộ vòng đời của một chuyến đi trong hệ thống **UIT-Go**, bao gồm:

* Tạo chuyến (`requested`)
* Tài xế chấp nhận (`accepted`)
* Đang diễn ra (`ongoing`)
* Hoàn thành (`completed`)
* Hủy (`cancelled`)

Hệ thống cần đảm bảo **transactional consistency** khi cập nhật nhiều bảng liên quan (trip, driver, payment...) trong cùng một luồng nghiệp vụ. Đồng thời, cơ sở dữ liệu phải có khả năng **scale**, **lưu trữ dữ liệu không gian (geolocation)**, và duy trì **hiệu năng ổn định** khi tải tăng cao.

---

## 2. Quyết định

Chọn **PostgreSQL** làm cơ sở dữ liệu chính cho `TripService`.

PostgreSQL cung cấp:

* **ACID transactions** đảm bảo tính toàn vẹn dữ liệu trong các nghiệp vụ phức tạp.
* **PostGIS** để xử lý dữ liệu địa lý và truy vấn theo tọa độ.
* **Cột JSONB** hỗ trợ lưu metadata linh hoạt mà vẫn chỉ mục hóa hiệu quả.
* **Partitioning và read replicas** cho phép mở rộng khi số lượng bản ghi tăng mạnh.

---

## 3. Lý do chọn PostgreSQL

PostgreSQL giúp đạt được **mục tiêu của Module A: Thiết kế Kiến trúc cho Scalability & Performance** nhờ các đặc tính sau:

1. **Độ nhất quán cao:**
   Các luồng nghiệp vụ của TripService — như *booking trip*, *accept trip*, *update payment* — đều yêu cầu atomic transaction. PostgreSQL bảo đảm không có trạng thái trung gian gây lỗi (ví dụ: payment tạo nhưng trip chưa hoàn tất).

2. **Mở rộng hiệu quả:**

   * Hỗ trợ **read replica** để tăng throughput khi đọc.
   * **Partitioning theo thời gian hoặc khu vực** giúp giảm kích thước bảng chính, cải thiện tốc độ truy vấn.
   * Có thể tích hợp **pgBouncer** để quản lý connection pool hiệu quả khi nhiều microservice cùng kết nối.

3. **Tối ưu hiệu năng ghi & đọc:**
   PostgreSQL có thể được tối ưu bằng **index thông minh** (partial index cho trạng thái `requested`/`ongoing`), **tuning WAL**, và **tối ưu autovacuum**.
   Việc dùng ổ **NVMe** hoặc cloud storage hiệu năng cao sẽ giảm latency khi commit transaction.

4. **Tích hợp linh hoạt với kiến trúc tổng thể:**

   * TripService có thể dùng PostgreSQL như **transactional source of truth**, kết hợp **event bus (RabbitMQ)** để phát sự kiện sang các service khác (ví dụ: `TripCreated`, `TripCompleted`).
   * Mô hình này thể hiện rõ tư duy **decoupling** nhưng vẫn đảm bảo consistency ở tầng dữ liệu cốt lõi.

5. **Trade-offs hợp lý:**

   * Ưu tiên **Consistency > Availability**, chấp nhận độ trễ nhỏ để tránh lỗi thanh toán hoặc trùng chuyến.
   * Nếu hệ thống mở rộng mạnh, có thể tách luồng đọc sang **CQRS pattern**: PostgreSQL phục vụ ghi, còn Elasticsearch/ClickHouse phục vụ đọc & báo cáo.

---

## 4. Các lựa chọn thay thế

| Lựa chọn         | Ưu điểm                                   | Nhược điểm                                         |
| ---------------- | ----------------------------------------- | -------------------------------------------------- |
| **MongoDB**      | Linh hoạt schema                          | Không phù hợp workflow có transaction phức tạp     |
| **MySQL**        | Hiệu năng tốt                             | Ít tiện ích hơn cho dữ liệu không gian, JSON       |
| **PostgreSQL** ✅ | ACID, hỗ trợ JSON, PostGIS mở rộng địa lý | Tốc độ ghi có thể chậm hơn với lượng write cực lớn |

**Kết luận lựa chọn:** PostgreSQL đạt cân bằng giữa tính ổn định, khả năng mở rộng, và sự linh hoạt trong thiết kế schema, giúp `TripService` vận hành ổn định và mở rộng theo nhu cầu.

---

## 5. Hệ quả

- ✅ Đảm bảo consistency giữa các trạng thái - chuyến đi và thanh toán.
- ✅ Dễ mở rộng theo chiều dọc hoặc thêm read replicas khi cần.
- ✅ Dễ tích hợp với các công cụ quan sát và giám sát hiệu năng (pg_stat_statements, Prometheus).
- ⚠️ Cần tối ưu schema, index và connection pool để duy trì hiệu năng khi số chuyến tăng lớn.
- ⚠️ Cần giám sát deadlock hoặc contention trên hàng dữ liệu tài xế để tránh bottleneck.

---

## 6.Kết luận:
PostgreSQL là lựa chọn hợp lý cho `TripService` trong bối cảnh yêu cầu transactional integrity và khả năng mở rộng có kiểm soát. Nó phản ánh đúng định hướng kiến trúc của Module A — **thiết kế hệ thống có thể mở rộng, duy trì hiệu năng và độ tin cậy cao**, đồng thời dễ dàng tích hợp với event bus hoặc caching layer trong tương lai.
