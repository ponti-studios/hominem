FROM node:26.3.0-alpine AS builder

WORKDIR /app

ARG VITE_PUBLIC_API_URL
ARG VITE_POSTHOG_HOST

ENV TURBO_TELEMETRY_DISABLED=1 \
    VITE_PUBLIC_API_URL=${VITE_PUBLIC_API_URL} \
    VITE_POSTHOG_HOST=${VITE_POSTHOG_HOST}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY tsconfig.profiles ./tsconfig.profiles
COPY tsconfig.json ./

RUN npm install -g pnpm@11.1.1 && \
    pnpm install --frozen-lockfile --filter @hominem/web...

# react-router build bundles all @hominem/* packages into build/server and build/client
RUN pnpm --filter @hominem/web run build

FROM node:26.3.0-alpine AS server

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache ca-certificates curl && \
    addgroup -g 1001 webuser && \
    adduser -D -u 1001 -G webuser -s /sbin/nologin -h /app webuser

# Install only the production server runtime — no pnpm, no workspace packages needed
RUN npm install --no-save @react-router/serve@7.14.0

COPY --from=builder --chown=webuser:webuser /app/apps/web/build ./apps/web/build

USER webuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f -s -m 2 http://localhost:${PORT:-3000}/ || exit 1

CMD ["node_modules/.bin/react-router-serve", "apps/web/build/server/index.js"]
