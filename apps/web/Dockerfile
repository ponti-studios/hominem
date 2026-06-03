# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.14.1

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    TURBO_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS builder

ARG VITE_PUBLIC_API_URL
ARG VITE_POSTHOG_HOST
ENV VITE_PUBLIC_API_URL=${VITE_PUBLIC_API_URL} \
    VITE_POSTHOG_HOST=${VITE_POSTHOG_HOST}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages
COPY apps/web ./apps/web
COPY tsconfig.profiles ./tsconfig.profiles
COPY tsconfig.json ./

RUN pnpm install --frozen-lockfile --filter @hominem/web...
RUN pnpm --filter @hominem/web build

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

RUN apk add --no-cache ca-certificates curl && \
    addgroup -g 1001 -S app && \
    adduser -S -D -u 1001 -G app -s /sbin/nologin -h /app app

RUN npm install --no-save @react-router/serve@7.14.0

COPY --from=builder --chown=app:app /app/apps/web/build ./build

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f -s -m 2 http://localhost:${PORT}/ || exit 1

CMD ["node_modules/.bin/react-router-serve", "./build/server/index.js"]
