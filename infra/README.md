# Infra Strategy

Infrastructure is organized by lifecycle and provider:

```text
infra/
  compose/
    base.yml
    dev.yml
    test.yml
  images/
    postgres/
      Dockerfile
  observability/
    README.md
  render/
    README.md
  kubernetes/
    README.md
  terraform/
    README.md
```

The compose stack keeps a checked-in `.env.example` alongside its stack definition, and the observability folder documents the local telemetry setup used by the dev stack.

Rules:

- Prefer Compose over bespoke workflow service definitions.
- CI should start the same Compose files that local developers use.
- Keep observability available in the dev stack.
- Do not introduce parallel Dockerfiles or image definitions for the same service lifecycle.
- Reserve `kubernetes/` and `terraform/` for future provider-specific definitions.
