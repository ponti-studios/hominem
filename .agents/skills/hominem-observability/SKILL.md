---
name: hominem-observability
description: Pull production logs, traces, and dashboards for Hominem (Fly logs and New Relic errors/traces/dashboards), diagnose incidents, and verify telemetry after deployment. Use for production error investigation, log tailing, speech-funnel debugging, or setting up dashboards/alerts.
---

# Hominem observability

Ownership split and the instrumentation privacy contract live in
[docs/observability.md](../../../docs/observability.md) — read it if you need
the "why" behind what's allowed in telemetry. This skill is the runbook.

New Relic is the primary home for API/worker traces, metrics, and
privacy-filtered application logs emitted through Hominem's shared logger. It
also receives Omiro mobile crashes and JavaScript errors. Fly.io is the source
of truth for complete container stdout/stderr (`fly logs`). Prod runs on Fly
(region sjc); app names are in `infra/fly/`. Do not put OTLP credentials or New Relic user
API keys in a Web or mobile bundle.

## Pull production logs

```bash
fly logs -a hominem-api              # live tail
fly logs -a hominem-api --no-tail    # recent buffer
fly logs -a hominem-worker --no-tail | grep -E 'error|warn'
```

Apps: `hominem-api`, `hominem-worker`, `hominem-web`, `hominem-career`,
`hominem-finance`, `hominem-redis`, `hominem-db`. `scripts/railway-logs.sh` is
legacy (Railway is no longer prod). New Relic is in the EU region
(`one.eu.newrelic.com`, OTLP `https://otlp.eu01.nr-data.net`); turn it on with
`infra/fly/enable-newrelic.sh`.

For aggregate database verification (reconciliation state, missing usage
events, current-month feature totals — no individual user data):

```bash
DATABASE_URL=<url> scripts/diagnose-usage.sh
```

Dashboard path: fly.io dashboard → app → Monitoring. Use api for HTTP/runtime,
worker for queue processing, redis for cache health, db for database events.

## New Relic errors and traces

Select the Hominem account and service. Use New Relic's API error views and
Distributed Tracing for request waterfalls; use the Omiro mobile app's handled
exceptions view for JavaScript errors. Dashboards cover latency, failure,
usage, and reconciliation. HTTP request metrics are unsampled; trace-based
feature diagnostics inherit the 10% parent sampling ratio.

## New Relic logs

Open Logs in the `hominem` account and filter by `service.name` (`api` or
`worker`), `deployment.environment.name`, `log.event`, `log.level`, or the
bounded attributes emitted by the shared logger. Use `fly logs` for raw dependency
stdout/stderr and platform/build logs, which are not forwarded to New Relic.

For error triage, start with production plus `failureType`; use
`failureCategory` for the broad HTTP class, `operation`/`failureStage` to locate
the failing step, and `retryable` to separate transient worker failures from
terminal ones. `api_request_failed` is the stable API failure event. Follow
`trace.id` into Distributed Tracing when it is present. Error messages and
record identifiers are intentionally omitted from New Relic log attributes.

In NRQL mode, these queries give a quick starting point:

```sql
FROM Log
SELECT count(*)
WHERE service.name = 'api'
  AND deployment.environment.name = 'production'
  AND log.event = 'api_request_failed'
FACET failureType
SINCE 24 hours ago
```

```sql
FROM Log
SELECT count(*)
WHERE service.name = 'worker'
  AND deployment.environment.name = 'production'
  AND failureType IS NOT NULL
FACET log.event, failureType
SINCE 24 hours ago
```

To inspect recent occurrences of one type, replace the aggregate with
`SELECT *` and add `AND failureType = 'note.not_found'`; set the time picker to
the incident window. New Relic documents the `FROM`, `FACET`, and time-window
query syntax in its [NRQL documentation](https://docs.newrelic.com/docs/nrql/get-started/introduction-nrql-how-nrql-works/).

Response procedure for an incident: New Relic Errors/trace waterfall → Fly
logs → database usage/reconciliation rows → local reproduction. Do not change
provider or deployment configuration based on a dashboard aggregate alone.

## Setting up dashboards and alerts

New Relic dashboard panels:

1. API speech p50/p95 `speech.time_to_first_audio_byte_ms`
2. Browser p50/p95 `speech.request_to_first_playable_ms`
3. Speech request count by `speech.outcome` and service
4. Browser playback count by completed/stopped/failed
5. Reconciliation success/retry/missing-generation-ID/terminal-failure counts
6. Usage-available ratio for `chat_speech`
7. API p50/p95 latency and 4xx/5xx rate by `http.route`
8. Worker queue snapshots and stalled-job count

Recommended alerts: browser first-playable p95 > 5s for 5min; failed browser
playback > 5% for 5min; any missing generation ID after a successful provider
stream; reconciliation terminal failures > 0; usage-available ratio < 99% over
15min; pending speech runs older than 5min; API 5xx rate > 2% for 5min; any
worker queue stalled event; Redis/database connectivity failure from
`/api/status`. Point alert ownership at the API/service owner.

## Local verification (before/after deploy)

```bash
cd ~/Developer/infra/foundation
just up
just health
just logs otel-collector
```

Jaeger: `http://localhost:16686`. Local app logs stay in the API/worker
terminal. Stop with `cd ~/Developer/infra/foundation && just down`.

After deployment: authenticate a controlled web session, play one response,
and confirm `speech.playback` and API `chat.speech` telemetry arrive in New
Relic, then confirm the usage event becomes available and the reconciliation
run ends in `succeeded`. Check the `telemetry_initialized` log after every
deployment — it reports the effective trace sampling ratio (normally 10%, with
child spans inheriting the parent decision).

## Instrumentation rules (when adding telemetry)

Never record prompts, model outputs, message contents, email addresses, user
IDs, message IDs, generation IDs, provider URLs, authorization data, or
provider error bodies in OTEL attributes or exported log bodies. OTEL log
export is allowlisted to operational messages and scalar fields only — see
[docs/observability.md](../../../docs/observability.md) for the current
allowlist before adding a new exported log line.
