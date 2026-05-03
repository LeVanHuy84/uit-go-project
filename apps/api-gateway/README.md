# API Gateway

## Service Responsibilities

- Acts as the external HTTP entrypoint for the platform.
- Routes requests to internal microservices over Nest TCP transport (user, trip, driver).
- Applies global JWT guarding, request validation, and URI versioning.
- Exposes a metrics endpoint for monitoring.

## Dependencies

- NestJS (common, core, platform-express, microservices).
- Redis (ioredis, @nestjs-modules/ioredis) for token/cache utilities.
- @repo/shared for DTOs, guards, filters, and shared contracts.

## Environment Variables

Template file: `.env.example`

- `GATEWAY_PORT`: gateway HTTP port (default: 4000).
- `USER_SERVICE_HOST`, `USER_SERVICE_PORT`: user-service TCP target.
- `TRIP_SERVICE_HOST`, `TRIP_SERVICE_PORT`: trip-service TCP target.
- `DRIVER_SERVICE_HOST`, `DRIVER_SERVICE_PORT`: driver-service TCP target.
- `JWT_SECRET`, `JWT_EXPIRES_IN`: JWT configuration.
- `REDIS_HOST`, `REDIS_PORT`: Redis connection settings.
- `RABBITMQ_USER`, `RABBITMQ_PASS`, `RABBITMQ_HOST`, `RABBITMQ_PORT`: RabbitMQ settings (currently not used directly by gateway publish/subscribe flows).

## Run This Service Only

From monorepo root:

```bash
npm install
copy apps/api-gateway/.env.example apps/api-gateway/.env
npm run start:dev --workspace=api-gateway
```

Or from service directory:

```bash
cd apps/api-gateway
npm install
npm run start:dev
```

## Database Migration / Seed

- This service does not connect to a database directly.
- No dedicated migration/seed process is required.

## Primary APIs

Base prefix: `/api/v1`

- `POST /api/v1/sessions`: login.
- `POST /api/v1/users`: create user.
- `GET /api/v1/users/me`: get current profile.
- `PUT /api/v1/users/me`: update current profile.
- `POST /api/v1/users/register-driver-profile`: register driver profile.
- `POST /api/v1/trips/price-estimate`: estimate fare.
- `POST /api/v1/trips`: create trip.
- `GET /api/v1/trips/:id`: get trip details.
- `POST /api/v1/trips/:id/cancel`: cancel trip.
- `POST /api/v1/trips/:id/accept`: accept trip.
- `POST /api/v1/trips/:id/complete`: complete trip (fire-and-forget event).
- `POST /api/v1/trips/:id/rating`: rate trip.
- `PUT /api/v1/drivers/:id/location`: update driver location (event).
- `PUT /api/v1/drivers/:id/status`: update driver status.
- `GET /api/v1/drivers/search`: search nearby drivers.
- `GET /api/v1/drivers`: list driver locations (debug).
- `POST /api/v1/drivers/reject`: reject trip.
- `POST /api/v1/drivers/accept`: accept trip.
- `GET /api/v1/metrics`: metrics endpoint.

## Queue / Topic Subscriptions and Publications

- No direct RabbitMQ publish/subscribe in this service.
- Primary inter-service communication is Nest TCP ClientProxy (`send`/`emit`).

## Swagger URL

- Swagger is not configured in the current codebase.
- URL: N/A.

## Testing

Inside `apps/api-gateway`:

```bash
npm run test
npm run test:e2e
npm run test:cov
```
