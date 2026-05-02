# ADR-0005: Sử dụng RabbitMQ cho kiến trúc Event-Driven

**Ngày:** 2025-10-28
**Trạng thái:** Accepted ✅
**Tác giả:** UIT-Go Backend Team

---

## 1. Ngữ cảnh

Trong hệ thống **UIT-Go**, nhiều microservice cần trao đổi dữ liệu và thông báo trạng thái cho nhau **một cách bất đồng bộ**, ví dụ:

* Khi **hành khách tạo chuyến đi** (`TripRequested`), `DriverService` cần nhận sự kiện để bắt đầu tìm tài xế khả dụng.
* Khi **tài xế nhận chuyến** (`TripAccepted`), `TripService` và `NotificationService` cần cập nhật trạng thái.
* Khi **chuyến đi hoàn tất** (`TripCompleted`), `PaymentService` cần được thông báo để xử lý thanh toán.

Mô hình này phù hợp với kiến trúc **Event-Driven Architecture (EDA)**, trong đó các service **không gọi trực tiếp nhau** mà giao tiếp qua **event bus**. Điều này giúp giảm **coupling**, tăng **scalability**, **resilience**, và phù hợp với mục tiêu của *Module A: Thiết kế Kiến trúc cho Scalability & Performance* — đảm bảo hệ thống chịu tải cao, xử lý song song và không bị nghẽn khi lượng request tăng đột biến.

---

## 2. Quyết định

Chọn **RabbitMQ** làm **message broker chính** cho hệ thống UIT-Go, phục vụ giao tiếp bất đồng bộ giữa các service theo mô hình event-driven.

---

## 3. Lý do chọn RabbitMQ

RabbitMQ đáp ứng tốt yêu cầu **scalability, performance và reliability** của Module A, đồng thời đơn giản cho môi trường demo:

1. **Triển khai nhanh và trực quan:**

   * Có thể khởi tạo qua Docker Compose chỉ với vài dòng cấu hình.
   * Giao diện **RabbitMQ Management UI** hỗ trợ quan sát exchange, queue, routing dễ dàng khi thực hiện load testing.

2. **Đa dạng mô hình routing:**

   * **Direct exchange** cho giao tiếp chính xác giữa producer-consumer.
   * **Topic exchange** cho broadcast linh hoạt (phù hợp khi mở rộng thêm NotificationService hoặc AnalyticsService).
   * **Fanout exchange** giúp lan truyền sự kiện realtime cho nhiều subscriber — hữu ích trong testing khả năng chịu tải.

3. **Hiệu năng và reliability cao:**

   * Độ trễ thấp (<10ms) trong môi trường nội bộ.
   * Cơ chế **acknowledgement**, **retry** và **Dead Letter Queue (DLQ)** giúp bảo đảm không mất message.
   * Dễ dàng kiểm chứng bằng **load testing (k6, JMeter)** để đo throughput và queue latency.

4. **Tối ưu cho microservices:**

   * Giảm coupling giữa các service → khi `TripService` phát event, `DriverService` chỉ cần lắng nghe, không phụ thuộc trực tiếp.
   * Hỗ trợ **scale out** bằng cách nhân bản consumer khi lượng event tăng.

5. **Phù hợp phạm vi đồ án:**

   * Nhẹ hơn Kafka nhưng vẫn thể hiện được bản chất **Event-Driven Architecture**.
   * Dễ trình bày mô hình queue/exchange trong báo cáo và demo thực tế.

---

## 4. Các lựa chọn thay thế

| Công nghệ        | Ưu điểm                                              | Nhược điểm                                                 |
| ---------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| **Kafka**        | Throughput cực cao, đảm bảo thứ tự và độ bền dữ liệu | Cấu hình phức tạp, nặng nề, không phù hợp cho demo nhỏ     |
| **Redis Stream** | Nhẹ, dễ tích hợp nếu đã dùng Redis trong hệ thống    | Routing hạn chế, thiếu cơ chế DLQ, khó mở rộng quy mô      |
| **RabbitMQ** ✅   | Routing mạnh, dễ triển khai, latency thấp            | Không tối ưu cho stream dài hạn, throughput thấp hơn Kafka |

**Kết luận lựa chọn:**
RabbitMQ đạt được **cân bằng giữa hiệu năng, đơn giản và khả năng mở rộng**, phù hợp cho yêu cầu của *Module A* — nơi cần một giải pháp **event-driven có khả năng chịu tải, dễ scale và dễ quan sát hiệu năng thực tế qua load test*.

---

## 5. Hệ quả

✅ Hệ thống hoạt động theo mô hình bất đồng bộ, giảm nghẽn cổ chai giữa các service.
✅ Dễ dàng mở rộng hoặc thêm mới service mà không ảnh hưởng logic hiện tại.
✅ Có thể nâng cấp lên Kafka nếu cần throughput cao hơn.
✅ Thuận tiện quan sát event flow trong demo, giúp thể hiện rõ kiến trúc EDA.
⚠️ Cần giám sát queue thường xuyên để tránh backlog.
⚠️ Cần cấu hình exchange type hợp lý để tránh broadcast không cần thiết.

---

## 6. Kết luận

RabbitMQ là lựa chọn thực tiễn và phù hợp với **Module A – Thiết kế Kiến trúc cho Scalability & Performance**, vì:

* Đảm bảo **tính chịu tải cao** nhờ cơ chế queue và consumer group.
* Dễ dàng mở rộng và thử nghiệm **scaling bằng load testing**.
* Tăng tính **resilience** nhờ mô hình event-driven bất đồng bộ.
* Dễ triển khai, trực quan hóa, và chứng minh hiệu quả kiến trúc trong phạm vi demo.

➡️ **Tổng kết:** RabbitMQ không chỉ giúp đạt mục tiêu kỹ thuật của Module A (scalability & performance), mà còn thể hiện rõ năng lực thiết kế kiến trúc có tính mở rộng, ổn định và dễ quan sát trong môi trường thực tế.
