# Trip Service

## Service Responsibilities

- Manages trip lifecycle: create, read, cancel, accept, complete.
- Calculates fare estimates.
- Stores and processes post-trip ratings.
- Coordinates matching-related events with driver-service through RabbitMQ.

## Dependencies

- NestJS microservices (TCP transport).
- TypeORM + PostgreSQL (@nestjs/typeorm, typeorm, pg).
- RabbitMQ (amqp-connection-manager, amqplib, @repo/shared RabbitmqModule).
- @repo/shared for DTOs and message constants.

## Environment Variables

Template file: `.env.example`

- `TRIP_SERVICE_HOST`, `TRIP_SERVICE_PORT`: trip-service TCP bind settings.
- `TRIP_DATABASE_URL`: PostgreSQL connection URL.
- `RABBITMQ_USER`, `RABBITMQ_PASS`, `RABBITMQ_HOST`, `RABBITMQ_PORT`: RabbitMQ connection settings.

## Run This Service Only

From monorepo root:

```bash
npm install
copy apps/trip-service/.env.example apps/trip-service/.env
npm run start:dev --workspace=trip-service
```

Or from service directory:

```bash
cd apps/trip-service
npm install
npm run start:dev
```

## Database Migration / Seed

- The service currently runs with TypeORM `synchronize: true`.
- No explicit migration/seed scripts are configured.
- For production, disable `synchronize` and adopt versioned migrations.

## Primary APIs

This is a TCP microservice. Primary message patterns:

- `get-price-estimate` (`TRIP_MESSAGE.GET_PRICE_ESTIMATE`).
- `create-trip` (`TRIP_MESSAGE.CREATE_TRIP`).
- `get-trip` (`TRIP_MESSAGE.GET_TRIP_BY_ID`).
- `cancel-trip` (`TRIP_MESSAGE.CANCEL_TRIP`).
- `accept-trip` (`TRIP_MESSAGE.ACCEPT_TRIP`).
- `complete-trip` (`TRIP_MESSAGE.COMPLETE_TRIP`).
- `rating-trip` (`TRIP_MESSAGE.RATING_TRIP`).

## Queue / Topic Subscriptions and Publications

Subscriptions:

- Queue `driver.events_queue` (exchange `driver.events`):
  - `driver.timeout`
  - `driver.accepted`

Publications:

- Exchange `trip.events`:
  - `trip.requested`
  - `trip.cancel`
  - `trip.completed`
- Exchange `notification`:
  - `driver.accepted`

## Swagger URL

- Swagger is not configured in the current codebase.
- URL: N/A.

## Testing

Inside `apps/trip-service`:

```bash
npm run test
npm run test:e2e
npm run test:cov
```
