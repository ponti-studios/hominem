# Railway

Railway is the deployment source of truth for the prototype phase.

Provider model:

- Railway project: `hominem`
- Railway environments: `preview`, `production`
- Shared environment shape:
  - `hominem-api`
  - `hominem-worker`
  - `hominem-web`
  - PostgreSQL
  - Redis

Config-as-code files:

- API: `services/api/railway.json`
- Worker: `services/api/worker/railway.json`
- Web: `apps/web/railway.json`

## Create The Project

1. Create a Railway project named `hominem`.
2. In the default environment, create:
   - a PostgreSQL service
   - a Redis service
   - three empty services named `hominem-api`, `hominem-worker`, and `hominem-web`
3. Rename the default environment to `preview`.
4. Duplicate `preview` into a second environment named `production`.

## Configure The Preview Environment

For each preview service:

- Source repo: `hackefeller/hominem`
- Branch: `preview`
- Root directory: `/`
- Wait for CI: enabled

Config file paths:

- API: `/services/api/railway.json`
- Worker: `/services/api/worker/railway.json`
- Web: `/apps/web/railway.json`

Domains:

- API: `api.preview.ponti.io`
- Web: `app.preview.ponti.io`

## Configure The Production Environment

For each production service:

- Source repo: `hackefeller/hominem`
- Branch: `main`
- Root directory: `/`
- Wait for CI: enabled

Config file paths:

- API: `/services/api/railway.json`
- Worker: `/services/api/worker/railway.json`
- Web: `/apps/web/railway.json`

Domains:

- API: `api.ponti.io`
- Web: `app.ponti.io`

## Variables

API and worker variables in `preview`:

- `NODE_ENV=production`
- `API_URL=https://api.preview.ponti.io`
- `WEB_URL=https://app.preview.ponti.io`
- `NOTES_URL=https://app.preview.ponti.io`
- `AUTH_PASSKEY_RP_ID=api.preview.ponti.io`
- `AUTH_PASSKEY_ORIGIN=https://api.preview.ponti.io`
- `AUTH_COOKIE_DOMAIN=.preview.ponti.io`
- `BETTER_AUTH_SECRET=<generated>`
- `DATABASE_URL=<PostgreSQL DATABASE_URL reference>`
- `REDIS_URL=<Redis URL reference>`
- `R2_ENDPOINT=<required>`
- `R2_BUCKET_NAME=hominem-storage`
- `R2_ACCESS_KEY_ID=<required>`
- `R2_SECRET_ACCESS_KEY=<required>`
- `RESEND_API_KEY=<required>`
- `RESEND_FROM_EMAIL=<required>`
- `RESEND_FROM_NAME=<required>`
- `SEND_EMAILS=true`
- `AUTH_E2E_ENABLED=true`
- `AUTH_E2E_SECRET=<required>`
- `OPENROUTER_API_KEY=<required>`
- `OTEL_EXPORTER_OTLP_ENDPOINT=<required>`
- `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`
- `OTEL_DEPLOYMENT_ENVIRONMENT=preview`
- `OTEL_SERVICE_NAMESPACE=hominem`
- `SENTRY_DSN=<required>`

Service-specific OTEL names:

- API: `OTEL_SERVICE_NAME=hominem-api`
- Worker: `OTEL_SERVICE_NAME=hominem-worker`

API and worker variables in `production`:

- `NODE_ENV=production`
- `API_URL=https://api.ponti.io`
- `WEB_URL=https://app.ponti.io`
- `NOTES_URL=https://app.ponti.io`
- `AUTH_PASSKEY_RP_ID=api.ponti.io`
- `AUTH_PASSKEY_ORIGIN=https://api.ponti.io`
- `AUTH_COOKIE_DOMAIN=.ponti.io`
- `BETTER_AUTH_SECRET=<generated>`
- `DATABASE_URL=<PostgreSQL DATABASE_URL reference>`
- `REDIS_URL=<Redis URL reference>`
- `R2_ENDPOINT=<required>`
- `R2_BUCKET_NAME=hominem-storage`
- `R2_ACCESS_KEY_ID=<required>`
- `R2_SECRET_ACCESS_KEY=<required>`
- `RESEND_API_KEY=<required>`
- `RESEND_FROM_EMAIL=<required>`
- `RESEND_FROM_NAME=<required>`
- `SEND_EMAILS=true`
- `AUTH_E2E_ENABLED=true`
- `AUTH_E2E_SECRET=<required>`
- `OPENROUTER_API_KEY=<required>`
- `OTEL_EXPORTER_OTLP_ENDPOINT=<required>`
- `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`
- `OTEL_DEPLOYMENT_ENVIRONMENT=production`
- `OTEL_SERVICE_NAMESPACE=hominem`
- `SENTRY_DSN=<required>`

Service-specific OTEL names:

- API: `OTEL_SERVICE_NAME=hominem-api`
- Worker: `OTEL_SERVICE_NAME=hominem-worker`

Web variables in `preview`:

- `NODE_ENV=production`
- `VITE_PUBLIC_API_URL=https://api.preview.ponti.io`
- `VITE_R2_DOMAIN=<required>`
- `VITE_POSTHOG_API_KEY=<required>`
- `VITE_POSTHOG_HOST=https://us.i.posthog.com`

Web variables in `production`:

- `NODE_ENV=production`
- `VITE_PUBLIC_API_URL=https://api.ponti.io`
- `VITE_R2_DOMAIN=<required>`
- `VITE_POSTHOG_API_KEY=<required>`
- `VITE_POSTHOG_HOST=https://us.i.posthog.com`

## Release Model

Railway handles branch-based autodeploys. `preview` deploys from the `preview` branch. `production` deploys from `main`.

The API service runs `pnpm run db:migrate:deploy` as its pre-deploy command. Because Railway deploys services independently, schema changes must stay backward-compatible across API, worker, and web rollouts.

If we need strict cross-service sequencing later, add a Railway API or CLI driven release workflow in GitHub Actions. For prototyping, native Railway autodeploy keeps cost and setup overhead lower.

## Mobile Wiring

Mobile is already wired to the hosted API domains:

- EAS `preview` -> `https://api.preview.ponti.io`
- EAS `production` -> `https://api.ponti.io`

Do not cut preview or production builds until the matching Railway API domain has valid TLS and returns `200` from `/api/status`.

## Smoke Checks

Preview:

```sh
curl --fail --silent --show-error https://api.preview.ponti.io/api/status
curl --fail --silent --show-error https://app.preview.ponti.io | grep -qi '<html'
```

Production:

```sh
curl --fail --silent --show-error https://api.ponti.io/api/status
curl --fail --silent --show-error https://app.ponti.io | grep -qi '<html'
```
