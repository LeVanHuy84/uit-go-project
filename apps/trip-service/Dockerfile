# =========================
# 1. PRUNE (TURBO)
# =========================
FROM node:20-alpine AS pruner
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=trip-service --docker 

# =========================
# 2. INSTALL (DEPENDENCIES)
# =========================
FROM node:20-alpine AS installer
WORKDIR /app
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
RUN npm run build

# =========================
# 4. RUNNER (PRODUCTION)
# =========================
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Add non-root user
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nextjs -u 1001

COPY --chown=nextjs:nodejs --from=builder /app/ .

USER nextjs
# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node --version || exit 1

EXPOSE 3002
CMD ["node", "apps/trip-service/dist/main"]
