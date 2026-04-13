# Local Observability

Jaeger ships with the local dev Compose stack, so there is no separate observability compose file anymore.

## Local Setup

Start the dev stack to bring up Jaeger alongside Redis and Postgres.

```sh
docker compose -f infra/compose/base.yml -f infra/compose/dev.yml up -d
```

The stack exposes OTLP HTTP on `http://localhost:4318`, OTLP gRPC on `4317`, and the Jaeger UI on `http://localhost:16686`.

## App Configuration

Point local services at OTLP HTTP on `http://localhost:4318` (the default). The env keys and local defaults live in [../../.env.example](../../.env.example).

## Production

In preview/prod, point OTEL at Sentry's OTLP endpoint. The deployed env examples live in [../railway/.env.preview.example](../railway/.env.preview.example) and [../railway/.env.production.example](../railway/.env.production.example).

## Notes

- Destroying the dev stack also removes local trace data by design.
- The dev stack is the only local observability entrypoint now.
