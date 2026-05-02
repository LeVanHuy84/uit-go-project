# UIT GO: Scalable Ride-Hailing Backend (NestJS Microservices)

UIT GO is a distributed ride-hailing backend built with NestJS in a Turborepo monorepo.
It showcases production-minded microservice design for low-latency dispatch, secure API access, and resilient event-driven workflows.
The platform emphasizes scalability, consistency trade-offs, and operability under load.

## Key Engineering Highlights

- API Gateway pattern with clear external HTTP and internal service boundaries.
- Hybrid communication: HTTP (client-facing), TCP (service RPC), RabbitMQ (async events).
- Redis Geo matching plus distributed lock keys, TTLs, and expiration listeners for reassignment.
- Retry + dead-letter queue strategy in RabbitMQ module setup.
- Dockerized system with Nginx and HAProxy for horizontal scaling patterns.
- Load-testing suite with k6 for throughput, latency, and error-rate validation.

## Features

- JWT authentication and gateway-level request guarding.
- Ride flow: trip request -> driver matching -> accept/reject/timeout -> complete.
- Near real-time driver discovery using Redis `geoadd`/`geosearch`.
- Event-driven orchestration across trip, driver, and notification exchanges.
- Concurrency controls: lock ownership checks, tried-driver sets, bounded retries, backoff.
- Shared contracts via `@repo/shared` (DTOs, message constants, RabbitMQ module, filters).

## System Architecture

- `api-gateway`: HTTP entrypoint (`/api/v1/*`), auth guard, validation, TCP client proxies.
- `user-service`: user/auth/profile domain with Prisma + PostgreSQL.
- `trip-service`: trip lifecycle, pricing, status transitions, rating (PostgreSQL).
- `driver-service`: location/status, Redis Geo search, matching and timeout handling.
- `auth-service`: separate scaffold in monorepo (not enabled by default in root compose).

Communication model:

- Client -> Gateway: HTTP.
- Gateway -> services: NestJS TCP transport.
- Service -> service async: RabbitMQ topic exchanges.
- Fast state/cache/locks: Redis with TTL and keyspace expiration events.

See `ARCHITECTURE.md` and `docs/ADR` for detailed architecture decisions.

## Tech Stack

- Backend: NestJS, TypeScript, Node.js, Turborepo.
- Data: PostgreSQL, Redis (Geo + cache + TTL).
- Messaging: RabbitMQ (topic exchanges, retry, DLQ flow).
- ORM: Prisma (`user-service`), TypeORM (`trip-service`).
- Security: JWT, Argon2.
- DevOps: Docker, Docker Compose, Nginx, HAProxy, GitHub Actions.
- Testing: Jest, k6.

## Project Structure

```text
apps/          api-gateway, auth-service, user-service, driver-service, trip-service
packages/      shared, eslint-config, typescript-config
docs/ADR/      architecture decision records
scripts/k6/    load-testing scenarios and datasets
nginx/         HTTP load balancing for API gateway
haproxy/       TCP load balancing for internal services
```

## Getting Started

### Prerequisites

- Docker + Docker Compose
- Node.js 18+ (optional for local non-Docker runs)

### Run Full Stack

```bash
docker compose up -d --build
```

Gateway URL: `http://localhost:4000`

Scale selected services:

```bash
docker compose up -d --build --scale api-gateway=2 --scale user-service=2 --scale trip-service=2 --scale driver-service=2
```

Stop:

```bash
docker compose down
docker compose down -v
```

## API / Usage

Gateway entrypoint: `/api/v1`

- `POST /sessions` (login)
- `POST /users`, `GET /users/me`, `PUT /users/me`
- `POST /trips`, `GET /trips/:id`, `POST /trips/:id/cancel`, `POST /trips/:id/accept`, `POST /trips/:id/complete`
- `PUT /drivers/:id/location`, `PUT /drivers/:id/status`, `GET /drivers/search`

Typical flow:

1. Passenger logs in and creates a trip.
2. Trip service publishes `trip.requested`.
3. Driver service matches nearby online driver with Redis Geo + lock.
4. Driver accepts (or timeout/reject triggers rematch).
5. Completion event sets driver back to online.

## Performance & Testing

- k6 scripts in `scripts/k6` cover login RPS, trip RPS, location ping, and profile read scenarios.
- Performance focus: p95 latency, error rate, throughput, and behavior under staged load.
- Resilience mechanisms include retries, lock expiration handling, and asynchronous decoupling.

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on push/PR:

- `npm ci`
- `npm run prisma:generate`
- `turbo` build for shared package
- monorepo lint + build

## Future Improvements

- Add distributed tracing and richer service-level observability.
- Introduce schema contract tests for async message payloads.
- Add stronger idempotency guarantees for critical event handlers.
- Add automated performance regression thresholds in CI.

## Author

Le Van Huy, Quach Vinh Co and Nguyen Dinh Huy.
