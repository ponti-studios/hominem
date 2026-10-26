# Hosting and credentials

Production runs on Fly.io. This document records where each piece runs and the
rotation state of the credentials the deployment uses, so neither has to be
inferred from a chat message or a stale workflow. Verified 2026-10-26T23:08Z
against the Fly API, the GitHub API, and every public hostname; the commands to
repeat it are at the end.

## Where production runs

| Public host         | Fly app           | Role                                                                  | Region |
| ------------------- | ----------------- | --------------------------------------------------------------------- | ------ |
| `api.ponti.io`      | `hominem-api`     | API, Better Auth, and the MCP server (`/api/mcp`) the ChatGPT and Claude connectors use | `sjc`  |
| —                   | `hominem-worker`  | BullMQ worker, no public hostname                                     | `sjc`  |
| —                   | `hominem-db`      | PostgreSQL 18 + pgvector + PostGIS, private only (`hominem-db.internal:5432`) | `sjc`  |
| —                   | `hominem-redis`   | Redis for BullMQ, private only (`hominem-redis.internal:6379`)        | `sjc`  |
| `omiro.ponti.io`    | `hominem-web`     | web app                                                               | `sjc`  |
| `career.ponti.io`   | `hominem-career`  | Career                                                                | `sjc`  |
| `finance.ponti.io`  | `hominem-finance` | Finance (manual deploy)                                               | `sjc`  |
| `ponti.io`          | `hominem-labs`    | studio site                                                           | `sjc`  |
| `newsboy.ponti.io`  | `newsboy`         | Newsboy                                                               | `sjc`  |

- The API, worker, web, career, finance, db, and redis apps run one machine
  each; `hominem-labs` and `newsboy` run two. All are `started` in `sjc` at the
  snapshot above. Each app with a configured check passes it; `hominem-db` and
  `hominem-redis` have none. `api.ponti.io/healthz` answers `200 ok`, and the
  MCP discovery documents (`/.well-known/oauth-protected-resource`,
  `/.well-known/oauth-authorization-server`) are served from the same host.
- Cloudflare proxies every public hostname (`server: cloudflare` and `cf-ray`
  in the response), and each hostname has an Issued Fly certificate. The Fly
  origin answers with `via: 1.1 fly.io`.
- A Cloudflare Transform Rule injects `X-Origin-Secret`, which the API's
  `ORIGIN_SECRET` enforces: a direct hit on a `*.fly.dev` hostname returns
  `403`, so only the proxied hostnames are entry points.
- Deploys are Fly-only. A merge to `main` runs `validate-*`, then `deploy-*`,
  then the reusable `fly-deploy-service.yml` (remote build, waits on health
  checks); `deploy-finance` is manual. Setup and the by-hand emergency path
  live in [infra/fly/README.md](../infra/fly/README.md).
- Railway no longer exists for us: the CLI account resolves to
  `deleted-…@deleted.railway.invalid`, nothing is linked, and PR #505 (merged
  2026-10-23) deleted every `railway.json`, `just/deploy.sh`, and Railway
  workflow. One leftover repository secret is listed below as stale.

## Region: compute is `sjc`, not the EU

The 25 Oct note that Hominem runs in the EU, on servers in the Netherlands,
does not describe the servers. Every machine of every Hominem app reports
region `sjc` (San Jose, California). `ams` exists in the Fly org but nothing
runs there.

What is European is the edge and part of the data path: a request to
`api.ponti.io` terminates at a Cloudflare and Fly edge PoP in Europe (observed
`lhr`, which Fly stamps in `fly-request-id`), telemetry goes to the New Relic
EU cell (`https://otlp.eu01.nr-data.net`), and R2 object storage is
Cloudflare's global bucket. None of that moves compute out of US-West.

**OPEN — USER DECISION REQUIRED:** if EU residency is a requirement (it matters
for the WYA-200 productization gate), production does not meet it today, and
the move is its own migration. If the EU note meant the edge and telemetry
path, there is nothing to do.

## Credential rotation state

"Rotated" here means the value in production was issued after the 22 Oct 2026
compromise. A value that was merely copied into Fly's secret store during the
overnight migration is _not_ rotated: Fly's `created_at` records only when the
value was stored, so on its own it does not prove anything was re-issued.
Evidence is noted per row.

| Credential                            | Held by                                                       | State             | Evidence                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Fly deploy token (`FLY_API_TOKEN`)    | GitHub Actions secret                                         | **Rotated**       | stored 2026-10-23T05:38Z, after the migration; the Railway token died with the Railway account                                                |
| PostgreSQL password                   | Fly secret on `hominem-db`; `DATABASE_URL` on api, worker, career, finance | **New**           | new 10 GB volume; password stored 2026-10-22T06:11Z, and `FLY_POSTGRES_PASSWORD` added as a repository secret 2026-10-23T04:53Z                |
| Redis password                        | Fly secret on `hominem-redis`; `REDIS_URL`                    | **New**           | new instance created 2026-10-22T06:11Z                                                                                                        |
| OpenRouter production key             | Fly secret `OPENROUTER_API_KEY` on api, worker, career        | **Rotated**       | the OpenRouter management API lists `hominem.prod`, created 2026-10-22T18:27Z, and the deployed key reports usage `0.031405535`, matching that key |
| OpenRouter management key             | Fly secret `OPENROUTER_MANAGEMENT_KEY`                        | **New**           | stored 2026-10-23T16:12Z, after the migration                                                                                                 |
| `ORIGIN_SECRET`                       | Fly secret, mirrored in the Cloudflare Transform Rule that sets `X-Origin-Secret` | **New**           | stored 2026-10-23T21:48Z; direct `*.fly.dev` requests are refused                                                                             |
| `RESEND_API_KEY`                      | Fly secret                                                    | **Not verified**  | the deployed key is send-only (`401 restricted to only send emails`), so it cannot list its siblings; the Resend console is the only source    |
| R2 access key and secret              | Fly secret                                                    | **Not verified**  | needs the Cloudflare R2 console; no Cloudflare token exists on this machine                                                                    |
| `BETTER_AUTH_SECRET`                  | Fly secret                                                    | **Not verified**  | no provider-side date exists. Only an operator rotation record proves it; if it was carried over, session cookies signed before 22 Oct still validate |
| New Relic licence key                 | Fly `OTEL_EXPORTER_OTLP_HEADERS` on api and worker            | **Not verified**  | stored 2026-10-22T21:54Z with the new OpenTelemetry wiring; the EU-cell key itself could predate that                                          |
| `OPENROUTER_API_KEY` (CI)             | GitHub repository secret                                      | **Not rotated**   | unchanged since 2026-10-02, before the compromise; `evals.yml` and `live-chat-smoke.yml` still use it                                          |
| `RAILWAY_SERVICE_FINANCE`             | GitHub repository secret                                      | **Stale**         | set 2026-09-08; nothing reads it                                                                                                              |
| Everything stored in database rows    | PostgreSQL                                                    | **Not rotated**   | the database was restored from the pre-migration dump (`infra/fly/README.md` step 3, the 21 Oct backup), so connector OAuth client secrets and per-user OpenRouter keys created before 22 Oct are still in production; session rows are too, though a session only validates if `BETTER_AUTH_SECRET` was left unchanged |

### Follow-ups this record creates

These are gaps found by the audit, not work done by it:

1. Rotate the CI `OPENROUTER_API_KEY` repository secret, which predates the
   compromise, and delete the stale `RAILWAY_SERVICE_FINANCE` secret.
2. Check each console for the Resend key, the R2 access key, the Better Auth
   secret, and the New Relic licence key, and rotate whatever was not re-issued
   after 22 Oct.
3. Decide what to force if the database restore counts as an exposure:
   rotating `BETTER_AUTH_SECRET` invalidates every session, and the ChatGPT and
   Claude connectors need re-consent rather than a key swap.
4. Decide the residency question above.

## Repeating the check

```bash
# Machines and region, health checks, and public hostnames
bash .agents/skills/hominem-production-check/scripts/check-production.sh

# Per-app machine region
fly machine list -a hominem-api --json | jq -r '.[] | [.id, .region, .state]'

# Which hostname each app serves
fly certs list -a hominem-api

# When each Fly secret value was stored (not when it was issued)
curl -sS -H "Authorization: Bearer $(fly auth token)" \
  https://api.machines.dev/v1/apps/hominem-api/secrets |
  jq -r '.secrets[] | [.created_at, .name] | @tsv'

# Repository secret timestamps
gh secret list --repo ponti-studios/hominem
gh api repos/ponti-studios/hominem/actions/secrets |
  jq -r '.secrets[] | [.updated_at, .name] | @tsv'
```

A deployed value can be read on the machine it runs on
(`fly ssh console -a hominem-api -C "printenv OPENROUTER_API_KEY"`) when a
provider's metadata is needed to date it, e.g. OpenRouter's
`GET https://openrouter.ai/api/v1/key` for the key's own usage and
`GET https://openrouter.ai/api/v1/keys` with the management key for every key's
`created_at`. Never paste a secret value into a document, issue, or pull
request.
