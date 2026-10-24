# Fly.io deploy

Merges to `main` deploy automatically: each `deploy-*` workflow runs after its
`validate-*` workflow passes and calls `.github/workflows/fly-deploy-service.yml`
(remote build, waits on health checks). `deploy-finance` is manual-only.
Repo config the workflows need:

- secrets: `FLY_API_TOKEN` (`fly tokens create org`), `FLY_POSTGRES_PASSWORD` (migrations, via `fly proxy`)
- variable: `VITE_POSTHOG_PROJECT_TOKEN` (public token baked into the web build)

Everything below is the by-hand path for first-time setup or emergencies.

Run everything from the repo root. Needs `fly auth login` first.
Region sjc (chosen to stay near the old Railway us-west2 footprint). Apps talk over `*.internal` (Fly private network).

## 1. Create apps + volumes
    fly apps create hominem-db hominem-redis hominem-api hominem-worker hominem-web hominem-career hominem-finance
    fly volumes create pgdata   -a hominem-db    -r sjc -s 10 -y
    fly volumes create redisdata -a hominem-redis -r sjc -s 1  -y

## 2. Secrets
    fly secrets set -a hominem-db POSTGRES_PASSWORD=<new>
    fly secrets set -a hominem-redis REDIS_PASSWORD=<new>
    # DATABASE_URL=postgresql://postgres:<pw>@hominem-db.internal:5432/hominem
    # REDIS_URL=redis://default:<pw>@hominem-redis.internal:6379
    # api + worker: DATABASE_URL REDIS_URL BETTER_AUTH_SECRET AUTH_COOKIE_DOMAIN OPENROUTER_API_KEY
    #   R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME R2_ENDPOINT R2_PUBLIC_URL RESEND_API_KEY
    #   (+ the *_MODEL vars and anything else in services/api/src/env.schema.ts)
    # web/career/finance: HOMINEM_INTERNAL_API_URL=http://hominem-api.internal:4040  PUBLIC_APP_URL
    #   (VITE_PUBLIC_API_URL is a BUILD arg, see step 4)

## 3. DB first, then restore
    fly deploy -c infra/fly/postgres.toml --ha=false
    fly deploy -c infra/fly/redis.toml --ha=false
    fly proxy 15432:5432 -a hominem-db &
    pg_restore --no-owner --no-privileges -d "postgresql://postgres:<pw>@localhost:15432/hominem" \
      ~/Backups/hominem/"hominem.2026-10-21–19-08.dump"

## 4. Services (remote builder; pass the PUBLIC api url as a build arg for web apps)
    fly deploy -c infra/fly/api.toml    --dockerfile services/api/Dockerfile        --ha=false
    fly deploy -c infra/fly/worker.toml --dockerfile services/api/worker/Dockerfile --ha=false
    fly deploy -c infra/fly/web.toml     --dockerfile apps/web/Dockerfile     --build-arg VITE_PUBLIC_API_URL=https://<public-api-host> --build-arg VITE_POSTHOG_PROJECT_TOKEN=<phc_token> --ha=false
    fly deploy -c infra/fly/career.toml  --dockerfile apps/career/Dockerfile  --build-arg VITE_PUBLIC_API_URL=https://<public-api-host> --ha=false
    fly deploy -c infra/fly/finance.toml --dockerfile apps/finance/Dockerfile --build-arg VITE_PUBLIC_API_URL=https://<public-api-host> --ha=false

## 5. Cutover
Add certs (`fly certs add <host> -a <app>`), then repoint DNS. Lower TTLs first.

## 6. Storage
The R2 bucket is private and uploads/reads go through presigned URLs. Bucket CORS, lifecycle and
the backfill are in [docs/file-uploads.md](../../docs/file-uploads.md).
