FROM node:26.4.0-alpine AS builder

WORKDIR /app

ENV TURBO_TELEMETRY_DISABLED=1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages ./packages
COPY services/api ./services/api
COPY tsconfig.profiles ./tsconfig.profiles
COPY tsconfig.json ./

RUN npm install -g pnpm@11.1.1 && \
    pnpm install --frozen-lockfile --filter @hominem/api...

# Bundle API + all npm dependencies into dist/ (fully self-contained)
RUN pnpm --filter @hominem/api run build

FROM node:26.4.0-alpine AS release

WORKDIR /app

ENV NODE_ENV=production \
    SERVICE_NAME=api \
    TURBO_TELEMETRY_DISABLED=1

RUN apk add --no-cache ca-certificates curl && \
    addgroup -g 1001 apiuser && \
    adduser -D -u 1001 -G apiuser -s /sbin/nologin -h /app apiuser && \
    mkdir -p /app/logs /tmp && \
    chown -R apiuser:apiuser /app /tmp && \
    chmod 700 /app/logs && \
    chmod 1777 /tmp

# Fully bundled application — no node_modules needed at runtime
COPY --from=builder --chown=apiuser:apiuser /app/services/api/dist ./dist

USER apiuser

EXPOSE ${PORT:-4040}

HEALTHCHECK --interval=30s --timeout=3s --start-period=3s --retries=3 \
    CMD curl -f -s -m 2 http://localhost:${PORT:-4040}/api/status || exit 1

CMD ["node", "dist/index.mjs"]
