# Production Dockerfile for Hominem Web App
# Multi-stage build with Node server for serving static files

# ============================================================================
# BUILDER STAGE - Build the web application
# ============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

ENV TURBO_TELEMETRY_DISABLED=1

COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY pnpm-workspace.yaml ./

COPY packages ./packages
COPY apps/web ./apps/web
COPY tsconfig.profiles ./tsconfig.profiles

RUN npm install -g pnpm@10.33.0 && \
    pnpm install --frozen-lockfile

RUN pnpm --filter @hominem/web run build

# ============================================================================
# SERVER STAGE - Serve built files with Node
# ============================================================================
FROM node:22-alpine AS server

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g serve

COPY --from=builder /app/apps/web/build ./build

EXPOSE 3000

CMD ["serve", "-s", "build", "-l", "3000"]
