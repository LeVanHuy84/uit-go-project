# Driver Service

## Service Responsibilities

- Manages driver location and availability status.
- Performs nearby-driver search using Redis GEO.
- Handles matching flow responses (accept/reject/timeout).
- Synchronizes driver state with trip lifecycle events.

## Dependencies

- NestJS microservices (TCP transport).
- Redis (ioredis, @nestjs-modules/ioredis).
- RabbitMQ (amqp-connection-manager, amqplib, @repo/shared RabbitmqModule).
- @repo/shared for DTOs, message constants, and shared filters.

## Environment Variables

Template file: `.env.example`

- `DRIVER_HOST`, `DRIVER_PORT`: driver-service TCP bind settings.
- `REDIS_HOST`, `REDIS_PORT`: Redis connection settings.
- `RABBITMQ_USER`, `RABBITMQ_PASS`, `RABBITMQ_HOST`, `RABBITMQ_PORT`: RabbitMQ connection settings.

## Run This Service Only

From monorepo root:

```bash
npm install
copy apps/driver-service/.env.example apps/driver-service/.env
npm run start:dev --workspace=driver-service
```

Or from service directory:

```bash
cd apps/driver-service
npm install
npm run start:dev
```

## Database Migration / Seed

- No active DB migration workflow is configured for this service.
- TypeORM DB wiring is currently commented out; the active runtime path is Redis + RabbitMQ.
- No seed script is defined.

## Primary APIs

This is a TCP microservice. Primary message/event patterns:

- Event `update-driver-location` (`DRIVER_MESSAGE.UPDATE_LOCATION`).
- Message `update-driver-status` (`DRIVER_MESSAGE.UPDATE_STATUS`).
- Message `search-nearby-drivers` (`DRIVER_MESSAGE.SEARCH_NEARBY`).
- Message `get_all_locations` (debug).
- Message `driver_reject_trip`.
- Message `driver_accept_trip`.

## Queue / Topic Subscriptions and Publications

Subscriptions:

- Queue `trip.events_queue` (exchange `trip.events`):
  - `trip.requested`
  - `trip.cancel`
  - `trip.completed`

Publications:

- Exchange `driver.events`:
  - `driver.timeout`
  - `driver.accepted`
- Exchange `notification`:
  - `driver.assigned`
  - `trip.cancelled`

## Swagger URL

- Swagger is not configured in the current codebase.
- URL: N/A.

## Testing

Inside `apps/driver-service`:

```bash
npm run test
npm run test:e2e
npm run test:cov
```
