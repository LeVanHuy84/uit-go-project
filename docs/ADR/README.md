# 🚖 UIT-Go – Architectural Decision Records (ADR)

Thư mục này lưu trữ **các quyết định kiến trúc quan trọng** của hệ thống **UIT-Go** — ứng dụng đặt xe theo mô hình microservices.  
Mỗi file `.md` trong thư mục này ghi lại **bối cảnh**, **quyết định**, **lựa chọn thay thế**, và **trade-off** của từng phần trong kiến trúc.

---

## 📋 Danh sách các ADR

| ID       | Tên quyết định              | Trạng thái  | Mô tả ngắn gọn                                   |
| -------- | --------------------------- | ----------- | ------------------------------------------------ |
| ADR-0001 | PostgreSQL cho UserService  | ✅ Accepted | Lưu trữ dữ liệu người dùng có quan hệ            |
| ADR-0002 | PostgreSQL cho TripService  | ✅ Accepted | Quản lý trạng thái chuyến đi và giao dịch        |
| ADR-0003 | Redis Geo cho DriverService | ✅ Accepted | Truy vấn vị trí tài xế nhanh theo thời gian thực |
| ADR-0004 | RESTful + TCP cho giao tiếp | ✅ Accepted | REST cho client, TCP cho nội bộ                  |
| ADR-0005 | RabbitMQ cho event-driven   | ✅ Accepted | Giao tiếp bất đồng bộ giữa các service           |

---

📅 _Cập nhật: 2025-10-28_  
👥 _Nhóm phát triển: UIT-Go Backend Team_
