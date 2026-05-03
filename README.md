# UIT GO: Scalable Ride-Hailing Backend (NestJS Microservices)

UIT GO is a distributed ride-hailing backend built with NestJS in a Turborepo monorepo. It is designed around low-latency dispatch, secure access, and event-driven coordination.
The codebase focuses on practical scalability: clear service boundaries, Redis-backed matching, RabbitMQ events, and Dockerized deployment.

## Key Engineering Highlights

- API Gateway with internal TCP service calls and external HTTP access.
- RabbitMQ topic exchanges with retry and dead-letter routing.
- Redis Geo matching, TTL-based locks, tried-driver sets, and expiration recovery.
- Dockerized stack with Nginx, HAProxy, Prometheus, and Grafana.
- k6 scripts for throughput, latency, and error-rate checks.

## Features

- JWT authentication and gateway-level request guarding.
- Ride flow: trip request -> match driver -> accept/reject/timeout -> complete.
- Driver proximity search via Redis `geoadd` / `geosearch`.
- Event-driven orchestration across trip, driver, and notification exchanges.
- Concurrency controls for duplicate assign avoidance and rematch.
- Shared contracts in `@repo/shared` for DTOs, messages, and filters.

## System Architecture

- `api-gateway`: HTTP entrypoint (`/api/v1/*`), validation, auth guard, TCP client proxies.
- `user-service`: user/auth/profile domain with Prisma + PostgreSQL.
- `trip-service`: trip lifecycle, pricing, status transitions, rating (PostgreSQL).
- `driver-service`: Redis Geo search, matching, and timeout handling.
- `auth-service`: separate scaffold in the monorepo (not enabled by default in compose).
- Sync path: client -> gateway -> service RPC; async path: RabbitMQ topic exchanges; hot state: Redis TTL + keyspace events.

See `ARCHITECTURE.md` and `docs/ADR` for the full design and trade-offs.

## Tech Stack

- Backend: NestJS, TypeScript, Node.js, Turborepo.
- Data: PostgreSQL, Redis.
- Messaging: RabbitMQ.
- ORM: Prisma (`user-service`), TypeORM (`trip-service`).
- Security: JWT, Argon2.
- DevOps: Docker, Docker Compose, Nginx, HAProxy, GitHub Actions.
- Testing: Jest, k6.

## Project Structure

- `apps/`: `api-gateway`, `auth-service`, `user-service`, `driver-service`, `trip-service`.
- `packages/`: `shared`, `eslint-config`, `typescript-config`.
- `docs/ADR/`: architecture decision records.
- `scripts/k6/`: load test scenarios and data sets.
- `nginx/` and `haproxy/`: load-balancing configs.

## Getting Started

Prerequisites: Docker, Docker Compose, and Node.js 18+ for local workflows.

```bash
docker compose up -d --build
```

Gateway entrypoint: `http://localhost:4000`

```bash
docker compose up -d --build --scale api-gateway=2 --scale user-service=2 --scale trip-service=2 --scale driver-service=2
docker compose down
docker compose down -v
```

## API / Usage

Gateway base path: `/api/v1`

- `POST /sessions` for login.
- `POST /users`, `GET /users/me`, `PUT /users/me` for profile flow.
- `POST /trips`, `GET /trips/:id`, `POST /trips/:id/cancel`, `POST /trips/:id/accept`, `POST /trips/:id/complete` for trip flow.
- `PUT /drivers/:id/location`, `PUT /drivers/:id/status`, `GET /drivers/search` for driver operations.

Flow: passenger creates a trip -> trip service publishes `trip.requested` -> driver service finds a nearby online driver using Redis Geo + lock -> driver accepts or times out -> trip is finalized and driver returns online.

## Performance & Testing

- k6 scripts in `scripts/k6` cover login RPS, trip RPS, location ping, and profile reads.
- Current focus is p95 latency, error rate, throughput, and behavior under staged load.

## Monitoring

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000` (`admin` / `admin`)
- Scrape target: `http://localhost:4000/api/v1/metrics`
- Grafana is provisioned with a Prometheus datasource and starter dashboard.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci`, `npm run prisma:generate`, shared package build, lint, and monorepo build on push and PR.

## Future Improvements

- Add service-level tracing and richer dashboards.
- Add contract tests for async message payloads.
- Add stronger idempotency guarantees for critical handlers.

## Author

Le Van Huy, Quach Vinh Co and Nguyen Dinh Huy.
