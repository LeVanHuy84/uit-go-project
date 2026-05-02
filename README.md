# 🚖 UIT-GO --- Hướng dẫn chạy local bằng Docker Compose

Dự án UIT-GO được xây dựng theo kiến trúc microservices. Tài liệu này
hướng dẫn bạn cách chạy ứng dụng ở môi trường local bằng **Docker
Compose**.

---

## 📦 1. Clone source code

Trước tiên, pull code ở **branch develop**:

```bash
git clone https://github.com/LeVanHuy84/uit-go-project.git
cd uit-go-project
git checkout develop
```

---

## 🛠 2. Chạy ứng dụng với 1 instance cho mỗi service

Lệnh sau sẽ build toàn bộ service và chạy mỗi service **1 instance**:

```bash
docker compose up -d --build
```

---

## 🚀 3. Chạy ứng dụng với scale nhiều instance

Nếu muốn chạy **2 instance** cho các service quan trọng (gateway, user,
trip, driver), dùng:

```bash
docker compose up -d --build \
  --scale api-gateway=2 \
  --scale user-service=2 \
  --scale trip-service=2 \
  --scale driver-service=2
```

Docker Compose sẽ tự tạo thêm các container instance tương ứng.

---

## 🔗 4. Gọi API

Gateway mặc định expose port **4000**, vì vậy mọi request HTTP đều gọi
qua:

    http://localhost:4000/...

Ví dụ:

    GET http://localhost:4000/api/v1/sessions

---

## 🧹 5. Dừng toàn bộ service

```bash
docker compose down
```

Nếu muốn xóa luôn volume:

```bash
docker compose down -v
```
