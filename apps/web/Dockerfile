# Production Dockerfile for Hominem Web App
# Multi-stage build with Node server for serving static files

# ============================================================================
# BUILDER STAGE - Build the web application
# ============================================================================
FROM oven/bun:1.3.0-alpine AS builder

WORKDIR /app

ENV NODE_ENV=production \
    TURBO_TELEMETRY_DISABLED=1

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

# ============================================================================
# SERVER STAGE - Serve built files with Node
# ============================================================================
FROM node:22-alpine AS server

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g serve

COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["serve", "-s", "build", "-l", "3000"]
