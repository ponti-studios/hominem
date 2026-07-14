---
status: in progress
goal: remove immediate correctness, safety, and security risks before deeper architecture work
---

# P0 Guardrails

## Summary

Make the system safe to work in while we clean up the monorepo. This batch of work will not implement any grand architecture moves.

Implement guardrails that prevent the monorepo from surprising developers, CI, or staging environments while larger cleanup happens.

## Findings

### `just lint fix` Is Broken

`scripts/command` dispatches `just lint fix` to `turbo lint:fix`, but `turbo.json` does not define a `lint:fix` task.

Evidence:

- [scripts/command](../../../scripts/command)
- [turbo.json](../../../turbo.json)

Confirmed command:

```bash
pnpm exec turbo run lint:fix --dry=json
```

Result: Turbo fails because `lint:fix` is missing.

Decision: Add a `lint:fix` Turbo task with empty outputs. Package scripts already mostly expose `lint:fix`, so the command grammar should stay intact.

### Non-Production Auth Header Bypass Is Too Broad

The API accepts `x-user-id` in non-production environments. MCP paths have similar behavior. If a preview or staging deployment ever runs with `NODE_ENV !== 'production'`, this becomes header-based impersonation.

Evidence:

- [services/api/src/middleware/auth.ts](../../../services/api/src/middleware/auth.ts)
- [services/api/src/mcp/routes.ts](../../../services/api/src/mcp/routes.ts)
- [services/api/src/mcp/server.ts](../../../services/api/src/mcp/server.ts)

Required shape:

- Header bypass must require explicit E2E enablement.
- Header bypass must require a shared secret.
- It should be unavailable in production regardless of other flags.

### Test Database Safety Depends On Convention

`just test` sets the intended test database URL, but package-level `pnpm test` can still run against whatever `DATABASE_URL` is in the shell. Some tests perform destructive cleanup. The repo should enforce safety at the DB/test boundary, not only through the `just` happy path.

Evidence:

- [scripts/command](../../../scripts/command)
- [packages/db/src/env.ts](../../../packages/db/src/env.ts)
- [services/api/src/routes/auth.step-up.test.ts](../../../services/api/src/routes/auth.step-up.test.ts)

Required shape:

- Tests that use the DB should refuse to run destructive setup unless `NODE_ENV=test`.
- The database host/name should match an allowlist, currently `127.0.0.1:5434/app-test`.
- The guard should live near the DB test utilities so direct package tests are still protected.

### Generated DB Types Have No Drift Check

`db codegen` is explicit, which is good. But CI validates migrations without verifying that generated Kysely types match the migrated schema.

Evidence:

- [scripts/command](../../../scripts/command)
- [packages/db/src/types/database.ts](../../../packages/db/src/types/database.ts)
- [.github/workflows/validate-db.yml](../../../.github/workflows/validate-db.yml)

Required shape:

- CI should run migrations against the test DB.
- CI should run `just db codegen`.
- CI should fail if `packages/db/src/types/database.ts` changes.

### Logging Redaction Is Shallow

The logging package has key-based redaction, but serialized errors can still carry full messages, stacks, URLs, or request context. The image proxy also logs requested URLs.

Evidence:

- [packages/telemetry/src/logger.ts](../../../packages/telemetry/src/logger.ts)
- [services/api/src/routes/images.ts](../../../services/api/src/routes/images.ts)

Required shape:

- Centralize URL/header/body sanitization.
- Hash or omit third-party URLs in logs.
- Do not log full stack traces for expected auth/validation failures during tests.

## Implementation Checklist

- [x] Add or repair `lint:fix` task support.
- [x] Gate auth test headers behind explicit E2E flag and secret.
- [x] Add DB test allowlist guard.
- [x] Add generated DB type drift check to database validation.
- [x] Tighten logging redaction and expected-error logging.
- [x] Update docs that still mention package-level test commands as the safe default.

## Validation

```bash
just lint fix api --dry-run
just test api
just db validate test
just check api
```

Also verify direct package-level tests that touch the database fail fast when pointed at a non-test database.
