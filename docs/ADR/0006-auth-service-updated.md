# ADR-0002 — Thiết kế AuthService: JWT-only, không lưu trạng thái (no refresh token, no DB/Redis/KMS/OAuth)

**Ngày:** 2025-11-02  
**Trạng thái:** Accepted ✅  
**Tác giả:** Nguyễn Đình Huy

---

## 1. Tóm tắt ngắn gọn
Trong phiên bản này, `AuthService` hoạt động hoàn toàn theo mô hình **stateless JWT-only**: 
- Chỉ phát và xác thực access token dưới dạng JWT ngắn hạn (gợi ý 5–15 phút).  
- Không sử dụng refresh token, không lưu session hoặc token state trong database/Redis.  
- AuthService được triển khai như một **module nội bộ thuộc UserService**, chia sẻ cùng database và PrismaService với UsersModule để truy cập trực tiếp dữ liệu người dùng và xác thực mật khẩu.

Mục tiêu: giảm độ phức tạp triển khai ban đầu (không cần DB/Redis/KMS/OAuth riêng biệt), tận dụng tính stateless của JWT để đơn giản hóa việc scale và tích hợp nhanh với kiến trúc microservices hiện có.

---

## 2. Quy ước & hợp đồng (contract)
- Inputs: credentials (email/phone + password).  
- Outputs: access JWT (compact JWT string), HTTP status codes (200/201/401/403/429).  
- Error modes: invalid credentials, expired access token, rate-limited requests.  
- Success criteria: access token có thể được verify bởi các service phụ thuộc bằng cách sử dụng cùng shared secret; khi token hết hạn, client phải xác thực lại (login) để lấy token mới.

---

## 3. Lý do kỹ thuật và quyết định chính

### 3.1. Stateless JWT-only
- Không có trạng thái session giúp giảm phụ thuộc hạ tầng (không cần DB/Redis cho session/token).  
- Thiết kế phù hợp cho bản demo / milestone 1 khi muốn đơn giản, nhanh đưa lên local bằng Docker Compose.

### 3.2. Signing algorithm — HS256 (HMAC)
- Chọn HS256 (HMAC + shared secret) vì không có KMS/vault; secret được cung cấp qua biến môi trường cấu hình cho tất cả service cần verify.  
- Lưu ý bảo mật: secret phải được quản lý cẩn thận trong CI/CD / container secrets; rotate secret theo chính sách vận hành (thủ công hoặc bằng pipeline).  

### 3.3. No refresh tokens / no persistent revocation
- Không dùng refresh tokens để tránh lưu trữ trạng thái.  
- Không thể revocation token cá thể (per-token revoke) trong thời gian thực vì không có store; giải pháp giảm rủi ro là giữ TTL ngắn cho access JWT và yêu cầu re-authentication khi expired.  

### 3.4. Kiến trúc module nội bộ
- `AuthModule` là một module con của `UserService`, được import trực tiếp trong `AppModule` của UserService.
- AuthModule và UsersModule chia sẻ cùng một `PrismaService` instance, cho phép AuthService truy cập trực tiếp vào bảng `users` mà không cần gọi API nội bộ.
- AuthService thực hiện xác thực mật khẩu trực tiếp bằng cách:
  1. Truy vấn user từ database qua PrismaService
  2. So sánh password hash bằng argon2
  3. Phát JWT nếu xác thực thành công

### 3.5. Password hashing location
- Passwords được hash bằng argon2 và lưu trữ trong database của UserService.
- AuthService truy cập trực tiếp password hash từ database thông qua PrismaService để thực hiện verification.

---

## 4. Kiến trúc & luồng hoạt động (high-level)

AuthModule components (minimal):
- HTTP API endpoints: `POST /session` (login), `GET /auth/validate` (optional, token introspection for admin/debug).  
- Configuration: SHARED_JWT_SECRET (env), JWT_EXPIRES_IN (config).  
- Shared dependencies: PrismaService (từ UserService root module).

Luồng đăng nhập (password):
1. Client POST /sessions {email, password}
2. AuthController nhận request và chuyển đến AuthService
3. AuthService sử dụng PrismaService để query user từ database: `prisma.user.findUnique({ where: { email } })`
4. AuthService verify password hash bằng argon2.verify(user.password, dto.password)
5. Nếu hợp lệ: AuthService tạo JWT với payload tối thiểu (user_id, role, exp) và ký bằng HS256.  
6. Trả về access JWT cho client. Client phải gửi token trên header Authorization: Bearer <token> cho các request kế tiếp.

Luồng khi token hết hạn:
- Client sẽ phải thực hiện login lại (POST /sessions) để lấy token mới.  

Kiến trúc module:
```
UserService (AppModule)
├── UsersModule
│   ├── UsersController
│   └── UsersService
├── AuthModule
│   ├── AuthController
│   └── AuthService
└── PrismaService (shared)
```

---

## 5. Data model / Lưu trữ
- AuthModule không có bảng migrate riêng, không cần database connection riêng.
- Credentials và password_hash nằm trong bảng `users` của UserService database (Postgres), được quản lý bởi Prisma schema chung.
- AuthService truy cập trực tiếp database thông qua PrismaService được inject từ root module.

---

## 6. Trade-offs & Alternatives

- Ưu điểm của approach này:
	- Đơn giản, dễ triển khai cho milestone/demo.  
	- Không cần hạ tầng bổ sung (DB/Redis/KMS riêng) cho AuthService.
	- Không cần API nội bộ giữa AuthService và UserService - giảm network overhead và latency.
	- Stateless, dễ scale ngang khi scale UserService.
	- Chia sẻ transaction context - có thể thực hiện atomic operations nếu cần (ví dụ: log audit và update user cùng transaction).

- Nhược điểm:
	- Không thể revoke token cá thể (chỉ revoke toàn bộ bằng cách rotate shared secret).  
	- UX kém hơn nếu token TTL quá ngắn (người dùng phải đăng nhập lại thường xuyên).  
	- HS256 yêu cầu quản lý bí mật chung giữa services — phải bảo vệ biến môi trường cẩn thận.
	- AuthModule và UsersModule phụ thuộc chặt chẽ vào UserService - khó tách thành microservice độc lập sau này mà không refactor.

- Alternatives:
	- Tách AuthService thành microservice độc lập với database riêng hoặc gọi UserService qua API nội bộ để verify credentials.
	- Thêm refresh tokens + server-side store (DB/Redis) để hỗ trợ session management và revoke nhanh.  
	- Dùng RS256 với JWKS + KMS để cho phép key rotation và public verification mà không lộ private key.

---

## 7. Non-functional requirements & bảo mật

- TLS bắt buộc giữa client ↔ API Gateway ↔ UserService.
- Bảo vệ shared secret: đặt qua secret manager của môi trường (Docker secrets, CI secrets, etc.).  
- Rate limiting / brute-force protection: giới hạn số lần login theo IP và theo account; tích hợp CAPTCHA hoặc progressive delays khi nhiều lần thất bại.  
- Audit logging: lưu event login success/fail, nguồn IP, user_agent vào centralized logger.  
- Monitoring: Prometheus metrics (login_count, failed_logins, token_issue_rate, latency).
- Password security: sử dụng argon2 cho hashing với các tham số phù hợp (memory cost, time cost, parallelism).

---

## 8. Kết luận
Phiên bản AuthService này lựa chọn sự đơn giản: triển khai như một module nội bộ của UserService, chỉ phát short-lived JWT, không lưu trạng thái, và truy cập trực tiếp database thông qua shared PrismaService để verify credentials. Giải pháp phù hợp cho môi trường demo/local và milestone ban đầu — đổi lại sẽ cần chấp nhận hạn chế về revocation và UX (không có refresh token), cũng như coupling chặt chẽ giữa AuthModule và UserService. 

Khi dự án chuyển sang production-scale, có thể mở rộng bằng cách:
- Tách AuthService thành microservice độc lập
- Thêm refresh tokens và server-side session store
- Sử dụng RS256 + KMS để hỗ trợ key rotation và revocation granular
- Triển khai CQRS pattern để tách biệt authentication và user management concerns

---

END
