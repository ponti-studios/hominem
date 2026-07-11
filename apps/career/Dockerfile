FROM node:26.1.0-alpine AS builder

WORKDIR /app

ARG VITE_DATABASE_URL

ENV TURBO_TELEMETRY_DISABLED=1 \
    VITE_DATABASE_URL=${VITE_DATABASE_URL}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages ./packages
COPY apps/career ./apps/career
COPY tsconfig.base.json ./
COPY tsconfig.profiles ./tsconfig.profiles
COPY tsconfig.json ./

RUN npm install -g pnpm@11.10.0 && \
    pnpm install --frozen-lockfile --filter @hominem/career...

# react-router build bundles all @hominem/* packages into build/server and build/client
RUN pnpm --filter @hominem/career run build

FROM node:26.1.0-alpine AS server

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

RUN apk add --no-cache ca-certificates curl && \
    addgroup -g 1001 careeruser && \
    adduser -D -u 1001 -G careeruser -s /sbin/nologin -h /app careeruser

COPY --from=builder --chown=careeruser:careeruser /app/apps/career/package.json ./package.json
RUN node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); pkg.dependencies = Object.fromEntries(Object.entries(pkg.dependencies ?? {}).filter(([, version]) => !String(version).startsWith('workspace:'))); delete pkg.devDependencies; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');" && \
    npm install --omit=dev --legacy-peer-deps
COPY --from=builder --chown=careeruser:careeruser /app/apps/career/package.json ./package.json
COPY --from=builder --chown=careeruser:careeruser /app/apps/career/build ./build

USER careeruser

EXPOSE 3000

# Railway injects PORT (often 8080). Bind the server to that port so the
# platform healthcheck and reverse proxy hit the right listener.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f -s -m 2 http://localhost:${PORT:-3000}/health || exit 1

CMD ["sh", "-c", "exec node_modules/.bin/react-router-serve ./build/server/index.js --port=${PORT:-3000}"]
