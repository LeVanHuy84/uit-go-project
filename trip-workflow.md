# 🚕 Luồng Hoạt Động Đặt Chuyến (Ride Request Flow)

## 1️⃣ Rider gửi yêu cầu đặt chuyến

**Luồng:**

- Người dùng mở app → bấm “Đặt xe”。
- Ứng dụng gọi API:

```http
POST /trips
```

→ Gateway → `trip-service`.

**Xử lý trong `trip-service`:**
- Validate thông tin (pickup, destination, payment, …)
- Tạo bản ghi Trip (`status = REQUESTED`)
- Gửi message (Kafka hoặc HTTP) đến `driver-service`:

```json
{
  "tripId": "uuid",
  "pickupLocation": { "lat": 10.762622, "lng": 106.660172 }
}
```

---

## 2️⃣ `driver-service` tìm tài xế phù hợp

- Nhận sự kiện `trip.requested`
- Gọi `findNearbyDrivers(pickupLocation)` → từ **Redis GEO**
- Lặp qua danh sách tài xế gần nhất, với mỗi tài xế:

```bash
SETNX lock:driver:{driverId} tripId EX 15
```

→ Nếu **lock thành công** thì gán tài xế đó。  
→ Nếu **lock thất bại** thì bỏ qua (tài xế đang bận)。

**Khi gán được tài xế:**
- Cập nhật `driver.status = BUSY`
- Trả kết quả về `trip-service`:

```json
{
  "driverId": "uuid",
  "driverInfo": { "name": "Nguyen Van A", "vehicle": "Yamaha" },
  "status": "ASSIGNED"
}
```

---

## 3️⃣ `trip-service` cập nhật chuyến đi

- Nhận thông tin tài xế được gán  
- Cập nhật:

```text
Trip.status = ASSIGNED
Trip.driverId = <driverId>
```

- Gửi **WebSocket notification** đến:
  - Rider: “Đã tìm thấy tài xế”
  - Driver: “Bạn có chuyến mới”

→ Sau đó chờ tài xế **chấp nhận** hoặc **từ chối**。

---

## 4️⃣ Driver phản hồi chuyến đi

- Nếu **chấp nhận**:

```http
PATCH /driver/trip/{tripId}/accept
```

→ `driver-service` gỡ lock hoặc cập nhật `status = ACCEPTED`  
→ Gửi event `"driver.accepted"` → `trip-service`  
→ `trip-service` cập nhật `Trip.status = ACCEPTED`

- Nếu **từ chối**:
  - Gỡ lock
  - Tiếp tục thử tài xế kế tiếp trong danh sách

---

## 5️⃣ Trong quá trình di chuyển

- `driver-service` nhận `updateLocation` định kỳ từ tài xế (2–5 giây/lần)  
  → Cập nhật vào Redis GEO

- `trip-service` nhận broadcast → cập nhật bản đồ real-time cho Rider。

---

## 6️⃣ Kết thúc chuyến đi

- Khi tài xế báo hoàn thành → `driver-service` gửi `"trip.completed"`

**Xử lý:**

`trip-service`:
- Cập nhật `Trip.status = COMPLETED`
- Tính cước, lưu DB

`driver-service`:
- Cập nhật `driver.status = AVAILABLE`
- Xóa lock nếu còn

---

## 🧩 Sơ đồ Sequence

```mermaid
sequenceDiagram
    participant Rider
    participant TripService
    participant DriverService
    participant Redis
    participant Notification

    Rider->>TripService: Request trip (pickup, destination)
    TripService->>DriverService: trip.requested(pickupLocation)

    DriverService->>Redis: GEOSEARCH nearby drivers
    loop For each driver
        DriverService->>Redis: SETNX lock:driver:{id} EX 15
        alt Lock success
            DriverService->>TripService: driver.assigned(driverId)
            DriverService->>Redis: Update driver.status=BUSY
            break
        else Lock fail
            DriverService->>DriverService: Skip to next driver
        end
    end

    TripService->>Notification: Notify Rider & Driver (trip assigned)

    DriverService->>TripService: driver.accepted / driver.rejected
    TripService->>Notification: Update status for Rider

    loop During trip
        DriverService->>Redis: updateLocation(driverId, geo)
        TripService->>Notification: Realtime driver location
    end

    DriverService->>TripService: trip.completed
    TripService->>Redis: Update trip.status=COMPLETED
    DriverService->>Redis: Update driver.status=AVAILABLE
```

---

## 🧱 Tổng kết luồng chính

| Bước | Dịch vụ chính       | Mô tả hành động |
|------|----------------------|-----------------|
| 1️⃣  | `trip-service`       | Nhận yêu cầu tạo chuyến |
| 2️⃣  | `driver-service`     | Tìm tài xế gần nhất và lock |
| 3️⃣  | `trip-service`       | Cập nhật trạng thái và thông báo |
| 4️⃣  | `driver-service`     | Xử lý chấp nhận / từ chối |
| 5️⃣  | `driver-service` + `trip-service` | Theo dõi vị trí real-time |
| 6️⃣  | `trip-service` + `driver-service` | Kết thúc chuyến, cập nhật dữ liệu |
