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

The Railway env shape now lives in example env files instead of this README:

- Preview: [./.env.preview.example](./.env.preview.example)
- Production: [./.env.production.example](./.env.production.example)

Set `OTEL_SERVICE_NAME` per service:

- API: `hominem-api`
- Worker: `hominem-worker`

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
