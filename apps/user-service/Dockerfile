# =========================
# 1. PRUNE (TURBO)
# =========================
FROM node:20-alpine AS pruner
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=user-service --docker 

# =========================
# 2. INSTALL (DEPENDENCIES)
# =========================
FROM node:20-alpine AS installer
WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com

COPY --from=pruner /app/out/json .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
COPY --from=pruner /app/turbo.json ./turbo.json
RUN npm ci --ignore-scripts && npm cache clean --force


# =========================
# 3. BUILD
# =========================
FROM node:20-alpine AS builder
WORKDIR /app


COPY --from=installer /app/ . 
COPY --from=pruner /app/out/full .

WORKDIR /app
RUN npm run prisma:generate


WORKDIR /app
RUN npm run build

# =========================
# 4. RUNNER (PRODUCTION)
# =========================
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl bash
# Add non-root user
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nextjs -u 1001

COPY --chown=nextjs:nodejs --from=builder /app/ .
COPY --chown=nextjs:nodejs --from=builder /app/node_modules/.prisma ./prisma
COPY --chown=nextjs:nodejs --from=builder /app/node_modules/@prisma ./generated


USER nextjs
# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node --version || exit 1

EXPOSE 4001
CMD ["node", "apps/user-service/dist/src/main"]