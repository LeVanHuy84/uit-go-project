# Auth Service

## Service Responsibilities

- Provides authentication logic as a TCP microservice.
- Handles login (`login`) and token verification (`validate-token`).
- Calls user-service to resolve users by email and validates passwords with bcrypt.

## Dependencies

- NestJS microservices (TCP transport).
- @nestjs/jwt for token signing and verification.
- bcrypt for password verification.
- @repo/shared for DTOs and message constants.

## Environment Variables

Template file: `.env.example`

- `JWT_SECRET`: JWT signing secret.
- `JWT_EXPIRES_IN`: token lifetime (for example, `1h`).
- `AUTH_HOST`, `AUTH_PORT`: auth-service TCP bind settings.
- `USER_HOST`, `USER_PORT`: user-service TCP target settings.

## Run This Service Only

From monorepo root:

```bash
npm install
copy apps/auth-service/.env.example apps/auth-service/.env
npm run start:dev --workspace=auth-service
```

Or from service directory:

```bash
cd apps/auth-service
npm install
npm run start:dev
```

## Database Migration / Seed

- This service does not manage a database directly.
- No dedicated migration/seed process is required.

## Primary APIs

This is a TCP microservice. Primary message patterns:

- `login` (`AUTH_MESSAGE.LOGIN`): authenticate and return access token + user summary.
- `validate-token` (`AUTH_MESSAGE.VALIDATE_TOKEN`): validate JWT and decode claims.

## Queue / Topic Subscriptions and Publications

- No direct RabbitMQ subscription/publication.
- Inter-service communication is TCP-based (`ClientProxy.send`) to user-service.

## Swagger URL

- Swagger is not configured in the current codebase.
- URL: N/A.

## Testing

Inside `apps/auth-service`:

```bash
npm run test
npm run test:e2e
npm run test:cov
```
