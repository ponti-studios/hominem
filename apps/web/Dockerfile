# Production Dockerfile for Hominem Web App
# Multi-stage build with Node server for serving static files

# ============================================================================
# BUILDER STAGE - Build the web application
# ============================================================================
FROM node:24.14.1-alpine AS builder

WORKDIR /app

ENV TURBO_TELEMETRY_DISABLED=1

COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY pnpm-workspace.yaml ./

COPY packages ./packages
COPY apps/web ./apps/web
COPY tsconfig.profiles ./tsconfig.profiles
COPY turbo.json ./turbo.json

RUN npm install -g pnpm@10.33.0 turbo@2.9.5 && \
    pnpm install --frozen-lockfile

RUN turbo run build --filter=@hominem/web

# ============================================================================
# SERVER STAGE - Serve built files with Node
# ============================================================================
FROM node:24.14.1-alpine AS server

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g serve

COPY --from=builder /app/apps/web/build ./build

EXPOSE 3000

CMD ["serve", "-s", "build", "-l", "3000"]
