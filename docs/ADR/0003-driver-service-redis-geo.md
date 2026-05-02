# ADR-0003: Sử dụng Redis Geospatial cho DriverService

**Ngày:** 2025-10-28
**Trạng thái:** Accepted ✅
**Tác giả:** Lê Văn Huy

---

## 1. Ngữ cảnh

`DriverService` chịu trách nhiệm:

* Cập nhật vị trí của tài xế theo thời gian thực.
* Tìm kiếm các tài xế ở gần vị trí đón của hành khách.
* Duy trì trạng thái hoạt động (online/offline) và khả năng nhận chuyến.

Đặc thù của bài toán này là yêu cầu **độ trễ cực thấp (<100ms)** trong việc định vị và tìm tài xế gần nhất, đặc biệt trong môi trường realtime như gọi xe (giống Grab/Uber). Đây là luồng nghiệp vụ quan trọng nhất ảnh hưởng trực tiếp đến **Scalability & Performance**, đúng với mục tiêu thiết kế của *Module A*.

---

## 2. Quyết định

Chọn **Redis với Geospatial Index** để lưu và truy vấn vị trí tài xế. Redis hỗ trợ các lệnh như `GEOADD`, `GEORADIUS`, `GEOSEARCH`, giúp:

* Lưu vị trí tài xế theo kinh độ/vĩ độ.
* Truy vấn tài xế trong bán kính nhất định với độ trễ thấp.
* Kết hợp tốt với cơ chế **pub/sub** để phát thông báo realtime.

Giải pháp này tập trung vào **tốc độ và khả năng mở rộng ngang**, là hai trụ cột chính của thiết kế kiến trúc trong Module A.

---

## 3. Các lựa chọn thay thế

| Lựa chọn               | Ưu điểm                                                                                                                 | Nhược điểm                                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DynamoDB + Geohash** | - Dễ mở rộng, managed service của AWS. <br> - Có thể kết hợp với DAX để tăng tốc.                                       | - Không hỗ trợ truy vấn bán kính natively (phải tự xử lý geohash, phức tạp). <br> - Tốn CPU và chi phí khi quét nhiều vùng dữ liệu. <br> - Quá phức tạp cho bài toán demo hoặc hệ thống nhỏ. |
| **Redis Geospatial** ✅ | - Lệnh GEO* tốc độ truy vấn <10ms. <br> - Dễ tích hợp với Node.js/NestJS. <br> - Realtime tốt nhờ in-memory và pub/sub. | - Dữ liệu lưu trong RAM, không phù hợp lưu lâu dài. <br> - Cần snapshot (RDB/AOF) nếu muốn tránh mất dữ liệu khi restart.                                                                    |
| **MongoDB 2dsphere**   | - Hỗ trợ dữ liệu document, dễ mở rộng query phức tạp.                                                                   | - Truy vấn bán kính chậm hơn Redis nhiều lần. <br> - Không phù hợp với luồng cập nhật hàng giây.                                                                                             |

---

## 4. Phân tích và đánh đổi

Lựa chọn Redis Geospatial thể hiện rõ định hướng thiết kế **tối ưu hóa cho latency và scalability**:

* **Latency-first:** Redis lưu dữ liệu trong bộ nhớ, giúp các thao tác cập nhật vị trí và tìm tài xế lân cận chỉ mất vài mili-giây.
* **Horizontal scaling:** Redis Cluster cho phép phân vùng theo khu vực hoặc shard key (ví dụ: vùng địa lý), dễ dàng mở rộng khi số lượng tài xế tăng cao.
* **Trade-off:** Đánh đổi độ bền dữ liệu để lấy tốc độ — phù hợp với đặc tính *ephemeral data* (vị trí tài xế thay đổi liên tục, không cần lưu dài hạn).
* **Realtime integration:** Cơ chế pub/sub tích hợp tự nhiên với Gateway (WebSocket/TCP) giúp phát sự kiện ngay khi tài xế thay đổi vị trí hoặc trạng thái.

Trong ngữ cảnh *Module A*, Redis là công cụ giúp kiến trúc sư đạt được **mục tiêu thiết kế hiệu năng và chịu tải cao**, thể hiện khả năng chủ động ra quyết định dựa trên đánh đổi kỹ thuật (Performance vs Durability).

---

## 5. Hệ quả

 - ✅ Truy vấn tài xế trong bán kính hoàn tất dưới 10ms.
- ✅ Cập nhật vị trí realtime và phản hồi nhanh với Gateway.
- ✅ Dễ mở rộng theo vùng (geo-sharding) và scaling cluster.
- ⚠️ Không phù hợp nếu cần lưu trữ lịch sử vị trí lâu dài (cần sync sang DB khác).
- ⚠️ Cần cấu hình persistence (AOF hoặc snapshot) để tránh mất dữ liệu khi restart.

---

## 6. Kết luận

Redis Geospatial là lựa chọn hợp lý và mang tính kiến trúc cao cho DriverService, phù hợp với mục tiêu của *Module A – Thiết kế Kiến trúc cho Scalability & Performance*, vì:

* Tập trung giải quyết bottleneck hiệu năng quan trọng nhất: truy vấn tài xế gần nhất.
* Hỗ trợ mở rộng ngang dễ dàng khi quy mô tăng (Redis Cluster).
* Thể hiện rõ trade-off có chủ đích giữa tốc độ, chi phí và độ bền dữ liệu.
* Dễ kiểm chứng bằng load testing (k6, JMeter) để đo latency và throughput.

Khi hệ thống phát triển lớn hơn, có thể kết hợp Redis với các giải pháp lưu trữ lâu dài (PostgreSQL, DynamoDB, hoặc ElasticSearch GeoPoint), đảm bảo vừa duy trì tốc độ realtime, vừa bảo toàn dữ liệu lịch sử.
