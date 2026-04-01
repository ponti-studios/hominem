# Local Observability Stack (ClickStack)

[ClickStack](https://clickhouse.com/docs/use-cases/observability/clickstack/overview) — logs, traces, metrics, and session replay in one place, backed by ClickHouse with full OpenTelemetry support.

## Stack

| Service        | Image                                      | Role                         |
| -------------- | ------------------------------------------ | ---------------------------- |
| ch-server      | `clickhouse/clickhouse-server:25.3-alpine` | Storage & query engine       |
| otel-collector | `clickhouse/clickstack-otel-collector:2`   | OTLP ingest (pre-configured) |
| hyperdx        | `clickhouse/clickstack-all-in-one:2`       | UI + API                     |
| mongo          | `mongo:7.0`                                | HyperDX metadata store       |

## Setup

```bash
# First time only
cp infra/docker/observability/.env.example infra/docker/observability/.env
# Edit .env if using non-default ClickHouse credentials
```

## Start

```bash
make obs-up
```

## Ports

| Port    | Service                     |
| ------- | --------------------------- |
| `4317`  | OTLP gRPC ingest            |
| `4318`  | OTLP HTTP ingest            |
| `8080`  | HyperDX UI                  |
| `8123`  | ClickHouse HTTP             |
| `8888`  | OTel collector metrics      |
| `13133` | OTel collector health check |

## App configuration

Point your services at the collector:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## Notes

- The collector is pre-configured for ClickHouse — no `otel-collector.yaml` needed.
- The observability stack uses its own `observability` Docker network and `obs-*` volumes, isolated from the dev stack.
- `make obs-down` destroys containers and volumes — telemetry data is not preserved across restarts by design.
- Volumes persist while containers are running; use `obs-down` to wipe all data.
