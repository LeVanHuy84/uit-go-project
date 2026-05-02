# ADR-0007: Performance Optimization

**Status:** Accepted  
**Date:** 2025-01-15  

---

## 1. Tóm tắt

Load testing baseline: **57.2 RPS, Gateway CPU 80%, matching 40-80ms** → không đủ để scale.

**Tối ưu:** Giảm CPU overhead + giảm network round-trips.

**Kết quả:** Throughput +58%, CPU -50%, matching latency -85%.

---

## 2. Vấn đề

### 2.1. Metrics

| Service | CPU | Issue |
|---------|-----|-------|
| Gateway | 80% | Bottleneck, không scale được |
| Matching | 60% | Latency 40-80ms quá chậm |

### 2.2. Root Causes

**Gateway (80% CPU):**
- PassportJS overhead: 40-50% CPU cho framework dư thừa (chỉ dùng JWT)
- JWT verify lặp lại: 1 user 10 requests = 10 lần verify cùng token
- Blocking operations: Accept/complete chờ response đồng bộ

**Matching (40-80ms latency):**
- 2 network round-trips: GEOSEARCH + Pipeline
- For-loop filtering ở Node.js thay vì Redis
- setTimeout spam cho retry

---

## 3. Giải pháp

### 3.1. Gateway

**A. JWT Caching**
- Cache kết quả decode trong Redis (TTL = token expiry)
- Hit ratio 80% → giảm 60-80% CPU
- Trade-off: Redis SPOF → mitigation: fallback + HA

**B. Loại PassportJS**
- Custom lightweight guard (2-3ms vs 5-7ms)
- Giảm 40-50% overhead
- Trade-off: Lost OAuth flexibility → OK vì chỉ dùng JWT

**C. Event-Driven**
- Emit event → respond ngay → xử lý async
- Latency -30-50%, không block event loop
- Trade-off: Client uncertainty → WebSocket notify

### 3.2. Matching

**A. Lua Script**
- Di chuyển toàn bộ logic vào Redis (1 round-trip)
- Latency 40-80ms → 5-10ms (-85%)
- Trade-off: Complexity → chấp nhận vì gain lớn

**B. MULTI/EXEC**
- Batch 4 lock operations → 1 round-trip
- Atomic, -75% latency

**C. Redis Retry Queue**
- Sorted Set + cron 5s thay setTimeout
- Scalable, persistent, no event loop spam
- Trade-off: ~5s delay → OK cho retry

**D. Sub-Services**
- Tách MatchingService → GeoQuery, DriverLock, MatchingDecision, Publisher
- Clean architecture, dễ test, maintainable

---

## 4. Kết quả

| Metric | Trước | Sau | Cải thiện |
|--------|-------|-----|-----------|
| Throughput | 57.2 RPS | 90.31 RPS | **+58%** |
| Gateway CPU | 80% | 37.92% | **-53%** |
| Matching CPU | 60% | 42.56% | **-29%** |
| Matching latency | 40-80ms | 5-10ms | **-85%** |
| JWT cache hit | N/A | 80% | **-80% CPU** |

**Scalability:** 62% CPU headroom → có thể scale tới 150+ RPS.

---

| Quyết định | Benefit | Trade-off | Acceptable vì |
|------------|---------|-----------|---------------|
| JWT Cache | -60-80% CPU | Redis SPOF | Fallback + HA cluster |
| Loại PassportJS | -40-50% overhead | Lost OAuth flexibility | Chỉ dùng JWT |
| Event-driven | -30-50% latency | Client uncertainty | WebSocket notify |
| Lua script | -85% latency | Debug khó | Performance >> complexity |
| Redis retry queue | Scalable, persistent | ~5s delay | OK cho retry |

**Alternatives không chọn:**
- Horizontal scaling: Cost 3x, không fix root cause
- In-memory cache: Không shared giữa instances
- GraphQL: Overkill, complexity >> benefit
- ElasticSearch: Redis đủ nhanh và đơn giản

---

## 6. Next Steps

**Immediate:**
- Setup monitoring dashboards (cache hit ratio, Lua performance)
- Load test ở 120-150 RPS để tìm bottleneck mới
- Configure alerts (retry queue depth, lock contention)

**Short-term (1-2 tháng):**
- Database optimization (connection pooling)
- Test horizontal scaling với event-driven
- Test fallback khi Redis down

**Long-term (3-6 tháng):**
- WebSocket notifications
- Geo-sharding (North/South Vietnam)
- RS256 JWT (better security)

---

