# User Service

## Service Responsibilities

- Manages user domain operations: create, read by email/id, and profile update.
- Manages driver profile registration for eligible users.
- Provides authentication-related handlers (`login`, `validate-token`) backed by user data.
- Persists data with Prisma + PostgreSQL.

## Dependencies

- NestJS microservices (TCP transport).
- Prisma ORM (@prisma/client, prisma) + PostgreSQL.
- argon2 for password hashing and verification.
- @nestjs/jwt for JWT operations.
- @repo/shared for DTOs and message constants.

## Environment Variables

Template file: `.env.example`

- `USER_DATABASE_URL`: PostgreSQL connection URL for Prisma.
- `USER_HOST`, `USER_PORT`: user-service TCP bind settings.
- `JWT_SECRET`, `JWT_EXPIRES_IN`: JWT configuration.

## Run This Service Only

From monorepo root:

```bash
npm install
copy apps/user-service/.env.example apps/user-service/.env
npm run prisma:generate --workspace=user-service
npm run start:dev --workspace=user-service
```

Or from service directory:

```bash
cd apps/user-service
npm install
npm run prisma:generate
npm run start:dev
```

## Database Migration / Seed

Prisma migration (development):

```bash
cd apps/user-service
npx prisma migrate dev --name <migration_name>
```

Apply migrations in deployment environments:

```bash
cd apps/user-service
npx prisma migrate deploy
```

Current repository status:

- Migrations exist under `prisma/migrations`.
- No Prisma seed script (`prisma db seed`) is currently configured.

## Primary APIs

This is a TCP microservice. Primary message patterns:

- `create-user` (`USER_MESSAGE.CREATE_USER`).
- `get-user-by-email` (`USER_MESSAGE.GET_USER_BY_EMAIL`).
- `get-user-by-id` (`USER_MESSAGE.GET_USER_BY_ID`).
- `update-user` (`USER_MESSAGE.UPDATE_USER`).
- `register-driver-profile` (`USER_MESSAGE.REGISTER_DRIVER_PROFILE`).
- `login` (`AUTH_MESSAGE.LOGIN`).
- `validate-token` (`AUTH_MESSAGE.VALIDATE_TOKEN`).

## Queue / Topic Subscriptions and Publications

- No direct RabbitMQ subscription/publication.
- Inter-service communication is handled via TCP message patterns.

## Swagger URL

- Swagger is not configured in the current codebase.
- URL: N/A.

## Testing

Inside `apps/user-service`:

```bash
npm run test
npm run test:e2e
npm run test:cov
```
