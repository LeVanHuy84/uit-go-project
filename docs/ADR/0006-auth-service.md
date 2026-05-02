
# ADR-0002 — Thiết kế AuthService: JWT-only, không lưu trạng thái (no refresh token, no DB/Redis/KMS/OAuth)

**Ngày:** 2025-11-02  
**Trạng thái:** Accepted ✅  
**Tác giả:** Nguyễn Đình Huy

---

## 1. Tóm tắt ngắn gọn
Trong phiên bản này, `AuthService` hoạt động hoàn toàn theo mô hình **stateless JWT-only**: 
- Chỉ phát và xác thực access token dưới dạng JWT ngắn hạn (gợi ý 5–15 phút).  
- Không sử dụng refresh token, không lưu session hoặc token state trong database/Redis.  
- AuthService không chứa database credential riêng: khi cần xác thực mật khẩu, AuthService gọi `UserService` (hoặc service chịu trách nhiệm credential) qua API nội bộ để kiểm tra credentials.  

Mục tiêu: giảm độ phức tạp triển khai ban đầu (không cần DB/Redis/KMS/OAuth), tận dụng tính stateless của JWT để đơn giản hóa việc scale và tích hợp nhanh với kiến trúc microservices hiện có.

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

### 3.4. Delegation of credential storage
- `UserService` là nơi lưu password hash và thực hiện verify password.  
- AuthService chỉ gửi yêu cầu xác thực tới `UserService` qua mTLS / internal authenticated channel và nhận kết quả thành công/thất bại.  

### 3.5. Password hashing location
- Passwords tiếp tục được hash bởi `UserService`. AuthService không lưu password hashes.

---

## 4. Kiến trúc & luồng hoạt động (high-level)

AuthService components (minimal):
- HTTP API endpoints: `POST /sessions` (login), `GET /sessions/validate` (optional, token introspection for admin/debug).  
- Configuration: SHARED_JWT_SECRET (env), TOKEN_TTL_SECONDS (config).  

Luồng đăng nhập (password):
1. Client POST /sessions {email, password}
2. AuthService gọi nội bộ `UserService` (POST /internal/auth/verify) truyền email + password để xác thực (UserService chịu trách nhiệm so sánh hash).  
3. Nếu hợp lệ: AuthService tạo JWT với payload tối thiểu (user_id, role, exp) và ký bằng HS256.  
4. Trả về access JWT cho client. Client phải gửi token trên header Authorization: Bearer <token> cho các request kế tiếp.

Luồng khi token hết hạn:
- Client sẽ phải thực hiện login lại (POST /sessions) để lấy token mới.  

---

## 5. Data model / Lưu trữ
- AuthService không có bảng migrate riêng. Không cần `auth_credentials` hay `refresh_tokens`.  
- Credentials và password_hash nằm trong `UserService` database (Postgres) như hiện tại trong kiến trúc.  

---

## 6. Trade-offs & Alternatives

- Ưu điểm của approach này:
	- Đơn giản, dễ triển khai cho milestone/demo.  
	- Không cần hạ tầng bổ sung (DB/Redis/KMS) cho AuthService.  
	- Stateless, dễ scale ngang.

- Nhược điểm:
	- Không thể revoke token cá thể (chỉ revoke toàn bộ bằng cách rotate shared secret).  
	- UX kém hơn nếu token TTL quá ngắn (người dùng phải đăng nhập lại thường xuyên).  
	- HS256 yêu cầu quản lý bí mật chung giữa services — phải bảo vệ biến môi trường cẩn thận.

- Alternatives:
	- Thêm refresh tokens + server-side store (DB/Redis) để hỗ trợ session management và revoke nhanh.  
	- Dùng RS256 với JWKS + KMS để cho phép key rotation và public verification mà không lộ private key.

---

## 7. Non-functional requirements & bảo mật

- TLS bắt buộc giữa client ↔ API Gateway ↔ AuthService và cho giao tiếp nội bộ `AuthService` ↔ `UserService` (thêm mTLS nếu có thể).  
- Bảo vệ shared secret: đặt qua secret manager của môi trường (Docker secrets, CI secrets, etc.).  
- Rate limiting / brute-force protection: giới hạn số lần login theo IP và theo account; tích hợp CAPTCHA hoặc progressive delays khi nhiều lần thất bại.  
- Audit logging: lưu event login success/fail, nguồn IP, user_agent (đến `UserService` hoặc centralized logger).  
- Monitoring: Prometheus metrics (login_count, failed_logins, token_issue_rate, latency).  

---

## 8. Kết luận
Phiên bản AuthService này lựa chọn sự đơn giản: chỉ phát short-lived JWT, không lưu trạng thái, và dựa vào `UserService` để verify credentials. Giải pháp phù hợp cho môi trường demo/local và milestone ban đầu — đổi lại sẽ cần chấp nhận hạn chế về revocation và UX (không có refresh token). Khi dự án chuyển sang production-scale, có thể mở rộng bằng cách thêm refresh tokens, server-side session store, hoặc RS256 + KMS để hỗ trợ key rotation và revocation granular.

---

END
