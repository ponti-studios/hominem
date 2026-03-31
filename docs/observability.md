# Observability

This repo uses OpenTelemetry for shared telemetry and a local ClickHouse + HyperDX workbench for inspection.

## Start the stack

```bash
make docker-up-observability
```

Run the smoke check after startup:

```bash
make obs-smoke
```

Or start the full local environment:

```bash
make docker-up-full
```

## Local defaults

Set these in your shell or `.env` when you want telemetry to ship to the local collector:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=1.0
```

## UI

- HyperDX: `http://localhost:8080`
- OTel ingest: `http://localhost:4318`
- OTel health: `http://localhost:13133`

## Stack

- `make obs-up` starts the HyperDX all-in-one stack.
- The container bundles ClickHouse, MongoDB, and the collector.
- All service metrics now route to ClickHouse/HyperDX via OpenTelemetry.

## Dashboards

- ClickStack query examples: `docs/clickstack-dashboards.md`
- The local UI is backed by ClickHouse, so the saved views and queries are ClickHouse-native.

## Notes

- `services/api` initializes telemetry at startup; `services/workers` is currently idle until background file-upload workers are added.
- `apps/web` already initializes browser telemetry in the root provider.
- Mobile stays on the existing PostHog path for this phase.

## Local verification

- Run `bash ./scripts/auth-e2e-flow.sh` to verify concrete API route spans appear in ClickHouse for the auth flow.
- Run `make obs-smoke` to verify the collector still ingests telemetry into ClickHouse.
- In HyperDX at `http://localhost:8080`, inspect `Traces`, `Logs`, and `Metrics` for `hominem-api` and any future worker service you enable locally.
- Request logs now emit OTEL log records with `trace_id` and `span_id`, so correlated log inspection should work in the local stack.
- Local API middleware emits `hominem_api_requests_total` and `hominem_api_request_duration_ms` metrics for HyperDX verification.
