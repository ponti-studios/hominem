---
name: hominem-observability
description: Pull production logs, traces, and dashboards for Hominem (Railway logs and New Relic errors/traces/dashboards), diagnose incidents, and verify telemetry after deployment. Use for production error investigation, log tailing, speech-funnel debugging, or setting up dashboards/alerts.
---

# Hominem observability

Ownership split and the instrumentation privacy contract live in
[docs/observability.md](../../../docs/observability.md) — read it if you need
the "why" behind what's allowed in telemetry. This skill is the runbook.

New Relic is the primary home for API/worker traces, metrics, and
privacy-filtered application logs emitted through Hominem's shared logger. It
also receives Omiro mobile crashes and JavaScript errors. Railway is the source
of truth for complete container stdout/stderr and platform
HTTP/build/Redis/database logs. Do not put OTLP credentials or New Relic user
API keys in a Web or mobile bundle.

## Pull production logs

```bash
scripts/railway-logs.sh api --since 1h
scripts/railway-logs.sh worker --filter '@level:error OR @level:warn'
scripts/railway-logs.sh api --http --status '>=400' --since 1h
scripts/railway-logs.sh worker --follow
scripts/diagnose-speech.sh 30m
```

Service aliases: `api`, `worker`, `redis`, `database`. The script targets the
Hominem production project explicitly — it doesn't depend on your locally
linked Railway project. Override when needed:

```bash
RAILWAY_PROJECT_ID=<project-id> RAILWAY_ENVIRONMENT=staging \
  scripts/railway-logs.sh api --since 30m
```

For aggregate database verification (reconciliation state, missing usage
events, current-month feature totals — no individual user data):

```bash
DATABASE_URL=<url> scripts/diagnose-usage.sh
```

Dashboard path: Railway → Hominem → environment → service → Logs. Use API for
HTTP/runtime, worker for queue processing, Redis for cache health, database
for database events. Prefer the HTTP log view over structured app logs when a
request status/path/duration/Railway request ID is more useful.

## New Relic errors and traces

Select the Hominem account and service. Use New Relic's API error views and
Distributed Tracing for request waterfalls; use the Omiro mobile app's handled
exceptions view for JavaScript errors. Dashboards cover latency, failure,
usage, and reconciliation. HTTP request metrics are unsampled; trace-based
feature diagnostics inherit the 10% parent sampling ratio.

## New Relic logs

Open Logs in the `hominem` account and filter by `service.name` (`api` or
`worker`), `deployment.environment.name`, `log.event`, `log.level`, or the
bounded attributes emitted by the shared logger. Use Railway for raw dependency
stdout/stderr and Railway edge/build logs, which are not forwarded to New Relic.

Response procedure for an incident: New Relic Errors/trace waterfall → Railway
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
