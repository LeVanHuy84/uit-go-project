# ADR-0004: Sử dụng RESTful cho API Gateway, TCP cho giao tiếp nội bộ và WebSocket cho realtime client

**Ngày:** 2025-10-28
**Trạng thái:** Accepted ✅
**Tác giả:** UIT-Go Backend Team

---

## 1. Ngữ cảnh

UIT-Go được xây dựng theo mô hình **microservices**, bao gồm:

* `UserService`, `TripService`, `DriverService` và `API Gateway`.
* Ứng dụng **Client (mobile/web)** là bên tiêu thụ chính, kết nối qua Gateway.

Cần xác định **phương thức giao tiếp tối ưu** cho từng luồng:

1. **Client ↔ API Gateway**: nơi tiếp xúc trực tiếp với người dùng.
2. **API Gateway ↔ Internal Services**: nơi Gateway phân phối request đến từng service.
3. **Service ↔ Service**: nơi các service trao đổi dữ liệu hoặc thông báo trạng thái (event-driven).
4. **Realtime (Client ↔ Gateway)**: phục vụ cập nhật vị trí và thông báo realtime.

Mục tiêu:

* Giảm độ trễ (latency) và chi phí giao tiếp.
* Dễ phát triển, debug, và mở rộng.
* Phù hợp với phạm vi demo đồ án UIT-Go.
* Đáp ứng định hướng **Module A: Thiết kế Kiến trúc cho Scalability & Performance**, tập trung vào khả năng mở rộng, giảm độ trễ, và tổ chức luồng dữ liệu hiệu quả.

---

## 2. Quyết định

| Luồng giao tiếp                     | Phương thức                           | Mục tiêu                                       |
| ----------------------------------- | ------------------------------------- | ---------------------------------------------- |
| **Client ↔ API Gateway**            | **RESTful HTTP API (JSON)** ✅         | Dễ tích hợp, dễ debug, phù hợp frontend/mobile |
| **Client ↔ Gateway (Realtime)**     | **WebSocket (JSON)** 🕓 *Planned*     | Theo dõi vị trí, thông báo realtime            |
| **API Gateway ↔ Internal Services** | **TCP socket (hoặc gRPC-over-TCP)** ✅ | Hiệu năng cao, giảm overhead HTTP              |
| **Service ↔ Service**               | **Event-driven (RabbitMQ)** ✅         | Giao tiếp bất đồng bộ, tách biệt, dễ mở rộng   |

---

## 3. Phân tích lựa chọn

### 3.1. RESTful giữa **Client ↔ Gateway**

**Lý do chọn RESTful:**

* REST là **chuẩn phổ biến** trong hệ sinh thái web và mobile.
* **Client (React Native, Flutter, Web)** đều hỗ trợ tốt `HTTP + JSON`, không cần thêm stub hay middleware.
* Dễ dàng **debug và test** bằng Postman hoặc curl.
* Phù hợp với mô hình request/response: đăng ký, đăng nhập, tạo chuyến đi, hủy chuyến, đánh giá...

**Các lựa chọn thay thế:**

* `gRPC-Web` có tốc độ nhanh hơn nhưng **phức tạp khi triển khai trên browser** (cần proxy hoặc converter).
* `WebSocket` chỉ phù hợp cho luồng realtime (ví dụ: tracking tài xế), không tối ưu cho các API CRUD thông thường.

**Đánh đổi:**
RESTful có độ trễ cao hơn so với gRPC (vì JSON + HTTP/1.1 overhead), nhưng ưu tiên **tính phổ biến và đơn giản** cho client-side.

---

### 3.2. TCP giữa **Gateway ↔ Services**

**Lý do chọn TCP:**

* Các service giao tiếp thường xuyên, khối lượng lớn (ví dụ: Gateway gọi TripService để tạo chuyến, gọi DriverService để tìm tài xế).
* TCP có **độ trễ thấp**, loại bỏ overhead HTTP và header JSON.
* Dễ tùy chỉnh format dữ liệu nhị phân (protobuf hoặc messagepack).
* Có thể mở rộng thành **gRPC-over-TCP** nếu cần schema chặt chẽ.

**So sánh với REST/gRPC:**

| Giao thức         | Ưu điểm                                   | Nhược điểm                                       |
| ----------------- | ----------------------------------------- | ------------------------------------------------ |
| **REST (HTTP)**   | Đơn giản, dễ debug                        | Overhead lớn, không phù hợp gọi nội bộ nhiều lần |
| **gRPC (HTTP/2)** | Hiệu năng cao, contract rõ ràng           | Khó debug, setup phức tạp                        |
| **TCP** ✅         | Linh hoạt, ít overhead, đơn giản cho demo | Cần quản lý connection thủ công, log khó hơn     |

**Đánh đổi:**
TCP giúp giảm latency trong demo, tuy nhiên về sau nếu hệ thống phát triển lớn, có thể thay bằng gRPC để đảm bảo tính chuẩn hóa và quản lý schema tốt hơn.

---

### 3.3. Event-driven giữa **Service ↔ Service**

**Giải pháp:** Sử dụng **RabbitMQ** để giao tiếp bất đồng bộ.
Ví dụ:

* Khi `TripService` tạo chuyến đi mới, phát event `"trip.created"` → `DriverService` nhận và xử lý matching tài xế.
* Khi `DriverService` cập nhật vị trí, phát event `"driver.location.updated"` → `TripService` cập nhật trạng thái realtime.

**Lợi ích:**

* Giảm coupling giữa service.
* Cho phép retry và xử lý không đồng bộ.
* Dễ mở rộng nếu thêm NotificationService hoặc AnalyticsService trong tương lai.

---

### 3.4. WebSocket giữa **Client ↔ Gateway (Realtime)**

**Trạng thái:** 🕓 *Plan cho đồ án (không triển khai trong demo)*

**Lý do thêm WebSocket:**

* Hỗ trợ **cập nhật vị trí realtime** giữa tài xế và hành khách.
* Gửi **thông báo trạng thái** (trip accepted, driver arrived, trip cancelled, v.v.).
* Kết nối giữ lâu, tránh polling liên tục.
* Có thể tái sử dụng chung kết nối WebSocket cho nhiều loại event.

**Ví dụ:**

* `driver.location.updated` → Client cập nhật vị trí marker trên bản đồ.
* `trip.status.changed` → Gửi thông báo đến hành khách và tài xế.

**Đánh đổi:**
Tăng độ phức tạp khi triển khai (authentication trên socket, reconnect, event structure), nên được lên kế hoạch cho **giai đoạn mở rộng** sau demo.

---

## 4. Hệ quả

✅ Dễ phát triển frontend và test API (REST).
✅ Giao tiếp nội bộ nhanh, tiết kiệm tài nguyên (TCP).
✅ Service độc lập và mở rộng dễ dàng (Event-driven).
🕓 WebSocket mở hướng realtime client interaction.
⚠️ Cần cơ chế log/monitor TCP connection.
⚠️ Cần thêm middleware logging/trace cho Gateway.

---

## 5. Kết luận

Cấu trúc giao tiếp của UIT-Go được thiết kế với tiêu chí “**Simple outside, Fast inside**” và phản ánh đúng định hướng **Module A – Thiết kế Kiến trúc cho Scalability & Performance**:

* RESTful API đảm bảo tính phổ biến và dễ bảo trì cho client layer.
* TCP và RabbitMQ tối ưu throughput, giảm latency giữa các service.
* WebSocket được định hướng mở rộng, phục vụ realtime và nâng cao trải nghiệm người dùng.
* Kiến trúc tách biệt giao thức theo tầng giúp dễ scale độc lập từng phần (Gateway, TripService, DriverService, v.v.).

→ Cách tiếp cận này cân bằng giữa **tính khả thi cho demo** và **định hướng hiệu năng cho hệ thống thực tế**, phù hợp hoàn toàn với mục tiêu của Module A.
