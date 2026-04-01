# Infra Strategy

Infrastructure is organized by lifecycle and provider:

```text
infra/
  compose/
    base.yml
    dev.yml
    observability.yml
    test.yml
  images/
    postgres/
      Dockerfile
  observability/
    .env.example
    README.md
    clickhouse-config.xml
  kubernetes/
    README.md
  terraform/
    README.md
```

The compose and observability stacks each keep a checked-in `.env.example` alongside their stack definitions.

Rules:

- Prefer Compose over bespoke workflow service definitions.
- CI should start the same Compose files that local developers use.
- Keep observability separate from the default app and test stacks.
- Do not introduce parallel Dockerfiles or image definitions for the same service lifecycle.
- Reserve `kubernetes/` and `terraform/` for future provider-specific definitions.
