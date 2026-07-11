---
name: db-migrate
description: Strict Goose migration workflow for packages/db/migrations: write timestamped Up/Down SQL, apply local/test migrations, and regenerate Kysely types.
disable-model-invocation: true
---

Use this workflow for any schema change in `packages/db/migrations/`:

1. Create a new flat migration file named `YYYYMMDDHHMMSS_<domain>_<change>.sql`.
2. Keep one concern per file. Split schema creation, backfills, indexes, policies, and triggers when they are separate concerns.
3. Write a Goose `Up` section and a matching `Down` section.
4. Wrap multi-statement blocks in `-- +goose StatementBegin` and `-- +goose StatementEnd`.
5. Put the SQL change in the migration file, not in `packages/db/src/types/database.ts`.
6. Run `just db-migrate` to apply the migration to the local database and regenerate Kysely types.
7. If the change must also be applied to the test database, run `just db-setup test`.
8. Use `just db-status` or `just validate-migrations` to confirm the migration state when needed.
9. Review the resulting migration and generated type diff before moving on.

The repo convention is flat, chronological Goose migrations with clear suffixes for meaning, for example `20260709234400_create_app_calendar_import_tables.sql`.

If the command fails:

1. Check that Docker is running and the relevant Postgres containers are up (local on port 5434, test on port 4433).
2. Check that the migration SQL uses Goose markers correctly and that `Up` and `Down` are both present.
3. Run `just db-status` to inspect the current migration state before retrying.
