# Local Observability

Jaeger ships with the local dev Compose stack, so there is no separate observability compose file anymore.

## Local Setup

Start the dev stack to bring up Jaeger alongside Redis and Postgres.

```sh
docker compose -f infra/compose/base.yml -f infra/compose/dev.yml up -d
```

The stack exposes OTLP HTTP on `http://localhost:4318`, OTLP gRPC on `4317`, and the Jaeger UI on `http://localhost:16686`.

## App Configuration

Point local services at OTLP HTTP on `http://localhost:4318` (the default).

## Production

In staging/prod, swap the OTLP endpoint for [Axiom](https://axiom.co) and add a `SENTRY_DSN` for error tracking. No code changes required — environment variables only.

```
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.axiom.co
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <token>,X-Axiom-Dataset=hominem
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
```

## Notes

- Destroying the dev stack also removes local trace data by design.
- The dev stack is the only local observability entrypoint now.
