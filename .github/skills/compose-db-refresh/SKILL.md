---
name: compose-db-refresh
description: 'Use when you need to tear down and rebuild the local Docker Compose database stack, apply Goose migrations, or regenerate Kysely types after schema changes.'
argument-hint: 'Local compose stack, migration target, or codegen note'
user-invocable: true
disable-model-invocation: false
---

# Compose DB Refresh

## When to Use

- The local Postgres containers are stale, corrupted, or need a clean reset.
- You changed SQL migrations under `packages/core/db/migrations`.
- You need to regenerate `packages/core/db/src/types/database.ts` after schema changes.

## Workflow

1. Tear down the current local compose stack before rebuilding it.
2. Recreate the stack with the shared base + dev compose files from `infra/compose/`.
3. Wait for the database container to become healthy before running database commands.
4. Apply the Goose migrations from `packages/core/db` against the local `DATABASE_URL`.
5. Verify the migration state with `goose:status` before moving on.
6. Run Kysely codegen from `packages/core/db` so generated types stay in sync.
7. Inspect the diff in `packages/core/db/src/types/database.ts` and keep it only when the schema change is intentional.

## Repo Commands

- Tear down the local development stack: `docker compose -f infra/compose/base.yml -f infra/compose/dev.yml down -v`
- Rebuild the local development stack: `docker compose -f infra/compose/base.yml -f infra/compose/dev.yml up -d --build --wait`
- Apply migrations: `bun run --cwd packages/core/db goose:up`
- Check migration status: `bun run --cwd packages/core/db goose:status`
- Regenerate Kysely types: `bun run --cwd packages/core/db kysely-codegen`

## Checks

- Confirm `DATABASE_URL` points at the compose Postgres instance on `127.0.0.1:5434`.
- If you need a truly clean reset, remove volumes during teardown; otherwise keep them to preserve data.
- If generated types change unexpectedly, rerun the workflow from teardown through codegen instead of editing generated output by hand.
- Keep this skill aligned with `infra/compose/*.yml` and `packages/core/db/package.json` if the repo changes its DB entrypoints.
