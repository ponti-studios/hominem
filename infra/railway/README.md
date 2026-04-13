# Railway

Railway is the deployment source of truth for the prototype phase.

Current operating mode:

- Production is the only active deploy target.
- Preview config stays in the repo for later reactivation.
- Preview services should be configured as dormant in Railway and must not autodeploy from `preview`.

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
- Branch: any non-shipping branch, or disable autodeploy entirely
- Root directory: `/`
- Wait for CI: enabled

Config file paths:

- API: `/services/api/railway.json`
- Worker: `/services/api/worker/railway.json`
- Web: `/apps/web/railway.json`

Domains:

- Do not attach preview custom domains while preview is paused.

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

Railway handles production deploys from `main`.

The `preview` environment remains defined for future reuse, but it is intentionally paused:

- no preview custom domains
- no preview autodeploy from `preview`
- no expectation that preview services are reachable or healthy

The API service runs `pnpm run db:migrate:deploy` as its pre-deploy command. Because Railway deploys services independently, schema changes must stay backward-compatible across API, worker, and web rollouts.

If we need strict cross-service sequencing later, add a Railway API or CLI driven release workflow in GitHub Actions. For prototyping, native Railway autodeploy keeps cost and setup overhead lower.

## Mobile Wiring

Mobile is already wired to the hosted API domains:

- EAS `preview` -> `https://api.ponti.io`
- EAS `production` -> `https://api.ponti.io`

Preview-profile builds remain available for insiders/TestFlight, but they talk to the production API while the shared preview environment is paused.

Do not cut mobile builds until the production API domain has valid TLS and returns `200` from `/api/status`.

## Smoke Checks

Production:

```sh
curl --fail --silent --show-error https://api.ponti.io/api/status
curl --fail --silent --show-error https://app.ponti.io | grep -qi '<html'
```
