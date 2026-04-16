FROM golang:1.25-alpine AS goose-builder

WORKDIR /src

RUN go install github.com/pressly/goose/v3/cmd/goose@v3.27.0

FROM node:24.14.1-alpine AS builder

WORKDIR /app

ENV TURBO_TELEMETRY_DISABLED=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy lock files first (these rarely change - best for caching)
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY pnpm-workspace.yaml ./

# Copy workspace structure (rarely changes after setup)
COPY packages ./packages
COPY services/api ./services/api
COPY tsconfig.profiles ./tsconfig.profiles

RUN npm install -g pnpm@10.33.0 && \
    pnpm install 2>&1 | grep -v "warn\|skipped" || true

FROM node:24.14.1-alpine AS release

WORKDIR /app

ENV NODE_ENV=production \
    TURBO_TELEMETRY_DISABLED=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apk add --no-cache ca-certificates curl

RUN npm install -g pnpm@10.33.0

RUN addgroup -g 1001 apiuser && \
    adduser -D -u 1001 -G apiuser -s /sbin/nologin -h /app hominem

RUN mkdir -p /app/logs && \
    mkdir -p /tmp && \
    chown -R hominem:apiuser /app /tmp && \
    chmod 700 /app/logs && \
    chmod 1777 /tmp

COPY --from=builder --chown=hominem:apiuser /app/package.json ./package.json
COPY --from=builder --chown=hominem:apiuser /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=hominem:apiuser /app/node_modules ./node_modules
COPY --from=builder --chown=hominem:apiuser /app/services/api ./services/api
COPY --from=builder --chown=hominem:apiuser /app/packages ./packages
COPY --from=builder --chown=hominem:apiuser /app/tsconfig*.json ./
COPY --from=goose-builder --chown=hominem:apiuser /go/bin/goose /usr/local/bin/goose

USER hominem

EXPOSE ${PORT:-3000}

HEALTHCHECK --interval=30s --timeout=3s --start-period=3s --retries=3 \
    CMD curl -f -s -m 2 http://localhost:${PORT:-3000}/api/status || exit 1

ENTRYPOINT ["pnpm", "--filter", "@hominem/api", "run", "start"]
CMD []
