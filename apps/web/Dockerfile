FROM node:24.14.1-alpine AS builder

WORKDIR /app

ARG VITE_PUBLIC_API_URL
ARG VITE_POSTHOG_API_KEY
ARG VITE_POSTHOG_HOST

ENV TURBO_TELEMETRY_DISABLED=1 \
    VITE_PUBLIC_API_URL=${VITE_PUBLIC_API_URL} \
    VITE_POSTHOG_API_KEY=${VITE_POSTHOG_API_KEY} \
    VITE_POSTHOG_HOST=${VITE_POSTHOG_HOST}

COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY pnpm-workspace.yaml ./
COPY patches ./patches

COPY packages ./packages
COPY apps/web ./apps/web
COPY tsconfig.profiles ./tsconfig.profiles

RUN npm install -g pnpm@10.33.0 && \
    pnpm install --frozen-lockfile --filter @hominem/web...

RUN pnpm --filter @hominem/env build

RUN pnpm --filter @hominem/web run build

FROM node:24.14.1-alpine AS server

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache ca-certificates curl && \
    npm install -g pnpm@10.33.0

RUN addgroup -g 1001 webuser && \
    adduser -D -u 1001 -G webuser -s /sbin/nologin -h /app hominem

COPY --from=builder --chown=hominem:webuser /app/package.json ./package.json
COPY --from=builder --chown=hominem:webuser /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=hominem:webuser /app/patches ./patches
COPY --from=builder --chown=hominem:webuser /app/node_modules ./node_modules
COPY --from=builder --chown=hominem:webuser /app/apps/web ./apps/web
COPY --from=builder --chown=hominem:webuser /app/packages ./packages
COPY --from=builder --chown=hominem:webuser /app/tsconfig*.json ./

USER hominem

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f -s -m 2 http://localhost:${PORT:-3000}/ || exit 1

CMD ["pnpm", "--filter", "@hominem/web", "run", "start"]
