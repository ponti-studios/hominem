FROM node:26.1.0-alpine AS builder

WORKDIR /app

ARG VITE_PUBLIC_SUPABASE_URL
ARG VITE_PUBLIC_SUPABASE_ANON_KEY
ARG VITE_DATABASE_URL

ENV TURBO_TELEMETRY_DISABLED=1 \
    VITE_PUBLIC_SUPABASE_URL=${VITE_PUBLIC_SUPABASE_URL} \
    VITE_PUBLIC_SUPABASE_ANON_KEY=${VITE_PUBLIC_SUPABASE_ANON_KEY} \
    VITE_DATABASE_URL=${VITE_DATABASE_URL}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/career ./apps/career
COPY tsconfig.profiles ./tsconfig.profiles
COPY tsconfig.json ./

RUN npm install -g pnpm@11.1.1 && \
    pnpm install --frozen-lockfile --config.trust-policy=ignore --filter @hominem/career...

RUN pnpm --filter @hominem/career run build

FROM node:26.1.0-alpine AS server

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache ca-certificates curl && \
    addgroup -g 1001 careeruser && \
    adduser -D -u 1001 -G careeruser -s /sbin/nologin -h /app careeruser

RUN npm install --no-save @react-router/serve@7.14.0

COPY --from=builder --chown=careeruser:careeruser /app/apps/career/build ./apps/career/build

USER careeruser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f -s -m 2 http://localhost:${PORT:-3000}/health || exit 1

CMD ["node_modules/.bin/react-router-serve", "apps/career/build/server/index.js"]
