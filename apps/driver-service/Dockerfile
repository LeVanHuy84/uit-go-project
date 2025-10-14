# apps/driver-service/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build --workspace=apps/driver-service

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/dist/apps/driver-service ./dist
COPY package*.json ./

RUN npm ci --omit=dev

CMD ["node", "dist/main.js"]
