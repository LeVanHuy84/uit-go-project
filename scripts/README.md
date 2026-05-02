🎯 1. Mục tiêu chính của bài test
👉 Đo sức chịu tải của endpoint login (POST /sessions) theo đơn vị RPS (Requests per second)

Nghĩa là:

Bạn muốn biết hệ thống xử lý được bao nhiêu login request/giây

Trong điều kiện tải tăng dần

Và đảm bảo các chỉ số độ trễ & lỗi vẫn trong ngưỡng chấp nhận được

Đây là dạng capacity test / load test theo arrival-rate.

🎯 2. Mô phỏng client gửi request liên tục theo tốc độ yêu cầu
Bạn không muốn mô phỏng user thật (concurrency),

mà muốn mô phỏng request hitting hệ thống liên tục, kiểu:

20 req/s

40 req/s

60 req/s

80 req/s

100 req/s

→ Điều này giúp đo “hệ thống chịu được bao nhiêu throughput thật sự”.

🎯 3. Đo độ trễ p95 < 400ms

Trong "thresholds", bạn yêu cầu:

95% request phải dưới 400ms

Nếu vượt → fail test

→ Mục tiêu: đảm bảo trong điều kiện tải tăng, API vẫn nhanh và ổn định.

🎯 4. Đảm bảo tỉ lệ lỗi < 0.1%

http_req_failed: ['rate<0.001']

→ Tức là error phải dưới 0.1%
→ Hệ thống không được quá tải gây lỗi 500/502/timeout

🎯 5. Tải được tăng theo từng stage
stages: [
{ target: 20, duration: '30s' },
{ target: 40, duration: '30s' },
{ target: 60, duration: '30s' },
{ target: 80, duration: '30s' },
{ target: 100, duration: '30s' },
]

→ Mục tiêu: xem API phản ứng ra sao khi tải tăng dần
→ Xác định điểm: API bắt đầu chậm hoặc xảy ra lỗi ở mức RPS nào

🎯 6. Kiểm tra chất lượng backend / gateway / DB / cache

Đoạn test login này giúp bạn kiểm tra:

tốc độ xử lý business logic

hiệu năng gateway load balancer

performance authentication service

tốc độ DB lookup với user credentials

độ ổn định under load

có nghẽn connection, timeout hay không

Đây là bài test "realistic but synthetic", rất phổ biến.

🎯 7. CSV giúp mô phỏng nhiều user khác nhau

Bạn random user theo \_\_ITER

→ tránh việc login cùng 1 account → kết quả chính xác hơn
→ mô phỏng real load từ nhiều người dùng thật

🎯 8. Không sleep → test thuần RPS

Vì arrival-rate là quy định tổng số request/giây, không phải hành vi người dùng.

→ Mục tiêu là đo throughput thực tế
→ Không đo user behavior

📌 Kết luận mục tiêu test

Bài test này giúp bạn trả lời các câu hỏi quan trọng:

Hệ thống chịu được bao nhiêu request login mỗi giây trước khi chậm hoặc lỗi?

Độ trễ p95 có giữ dưới 400ms trong toàn bộ quá trình tăng tải không?

Backend có ổn định khi tải tăng dần lên 100 RPS không?

Có lỗi 502/504/timeout gì xảy ra khi tăng RPS không?

Điểm nghẽn của hệ thống nằm ở đâu? (DB, CPU, gateway, service?)
