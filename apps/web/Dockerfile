# Production Dockerfile for Hominem Web App
# Multi-stage build with Node server for serving static files

# ============================================================================
# BUILDER STAGE - Build the web application
# ============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

ENV NODE_ENV=production \
    TURBO_TELEMETRY_DISABLED=1

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm@9.3.0 && \
    pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

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
