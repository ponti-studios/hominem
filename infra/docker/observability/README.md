# Local Observability Stack (ClickStack)

[ClickStack](https://clickhouse.com/docs/use-cases/observability/clickstack/overview) provides logs, traces, metrics, and session replay on top of ClickHouse with OpenTelemetry support.

## Stack

| Service        | Image                                         | Role                     |
| -------------- | --------------------------------------------- | ------------------------ |
| ch-server      | `clickhouse/clickhouse-server:26.2.6-alpine`  | Storage and query engine |
| otel-collector | `clickhouse/clickstack-otel-collector:2.22.1` | OTLP ingest              |
| hyperdx        | `clickhouse/clickstack-all-in-one:2.22.1`     | UI and API               |
| mongo          | `mongo:8.0`                                   | HyperDX metadata store   |

## Local Setup

- Create the local observability env file from the example before first use.
- Adjust credentials only if the defaults are not appropriate for the local environment.
- Treat the Compose file and the local env file in this directory as the source of truth for startup and teardown behavior.

## Ports

| Port    | Service                     |
| ------- | --------------------------- |
| `4317`  | OTLP gRPC ingest            |
| `4318`  | OTLP HTTP ingest            |
| `8080`  | HyperDX UI                  |
| `8123`  | ClickHouse HTTP             |
| `8888`  | OTel collector metrics      |
| `13133` | OTel collector health check |

## App Configuration

Point local services at OTLP HTTP on `http://localhost:4318`.

## Notes

- The collector is pre-configured for ClickHouse, so there is no separate collector config file to maintain in the repo.
- The observability stack uses its own Docker network and volumes, isolated from the main dev stack.
- Destroying the local observability stack also removes its telemetry data by design.
