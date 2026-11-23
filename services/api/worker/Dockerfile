FROM node:24.18.0-alpine AS builder

WORKDIR /app

ENV TURBO_TELEMETRY_DISABLED=1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY patches ./patches
COPY scripts ./scripts
COPY packages ./packages
COPY services/api ./services/api
COPY tsconfig.profiles ./tsconfig.profiles
COPY tsconfig.base.json ./
COPY tsconfig.json ./

# Org packages (@ponti-studios/*) resolve from GitHub Packages, which needs a
# token for metadata fetches too (pnpm's trust policy reads packuments for the
# whole lockfile, even entries outside the filtered graph). CI and Fly pass it
# as a build secret; without it, only npmjs packages resolve.
RUN --mount=type=secret,id=gh_packages_token \
    npm install -g pnpm@11.23.0 && \
    if [ -f /run/secrets/gh_packages_token ]; then \
      echo "//npm.pkg.github.com/:_authToken=$(cat /run/secrets/gh_packages_token)" >> ~/.npmrc; \
    fi && \
    pnpm install --frozen-lockfile --filter @hominem/api...

RUN pnpm --filter @ponti-studios/auth build
RUN pnpm --filter @hominem/api run build:worker

FROM node:24.18.0-alpine AS release

WORKDIR /app

ENV NODE_ENV=production \
    SERVICE_NAME=api-worker \
    TURBO_TELEMETRY_DISABLED=1

RUN apk add --no-cache ca-certificates && \
    addgroup -g 1001 apiuser && \
    adduser -D -u 1001 -G apiuser -s /sbin/nologin -h /app apiuser && \
    mkdir -p /app/logs /tmp && \
    chown -R apiuser:apiuser /app /tmp && \
    chmod 700 /app/logs && \
    chmod 1777 /tmp

COPY --from=builder --chown=apiuser:apiuser /app/services/api/dist/worker.mjs ./dist/worker.mjs

USER apiuser

CMD ["node", "dist/worker.mjs"]
