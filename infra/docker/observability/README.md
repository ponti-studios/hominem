# Local Observability Assets

This directory contains the provider-light observability stack used for local development.

## Stack

- ClickHouse for telemetry storage
- MongoDB for HyperDX metadata
- OpenTelemetry Collector for ingest and export
- HyperDX for querying traces, metrics, and logs

## Start

```bash
docker compose -f infra/docker/compose/base.yml -f infra/docker/compose/observability.yml up -d
```

## Ports

- `4318` - OTLP HTTP ingest
- `8080` - HyperDX UI
- `8123` - ClickHouse HTTP

## Notes

- App services should point `OTEL_EXPORTER_OTLP_ENDPOINT` at `http://localhost:4318`.
- The collector is intentionally local-dev friendly and can be stopped without affecting app startup.
