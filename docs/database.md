# Database access

`packages/db` is server-only. Client applications must use the API or RPC; they
must not connect to PostgreSQL directly. This guide covers local development,
tests, and read-only production inspection. For schema changes, repository work,
or production writes, follow the [`hominem-database` skill](../.agents/skills/hominem-database/SKILL.md).

## Local development and tests

The local development database listens on `127.0.0.1:5434` and the test database
on `127.0.0.1:4433`. The checked-in development credentials are for local use
only:

```bash
psql 'postgresql://postgres:postgres@127.0.0.1:5434/hominem'
psql 'postgresql://postgres:postgres@127.0.0.1:4433/hominem-test'
```

Set `DATABASE_URL` explicitly when running database commands or code that reads
it. Use the test URL for tests; never point a test at development or production.
The `just db` recipes are the repository command interface:

```bash
export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5434/hominem'
just db status
just db migrate
just db codegen
just db status test
```

`just db migrate test` selects the test database. Do not rely on a fallback URL
when running codegen, migrations, or tests. The actual local databases must be
running before connecting; see the [development runbook](../.agents/skills/hominem-development/SKILL.md)
for service startup and worktree setup.

## Production read-only inspection

Production PostgreSQL is the Fly app `hominem-db` (Postgres 18, region `sjc`,
`pgdata` volume). Its private hostname (`hominem-db.internal`) is not
resolvable from a local machine. Use a temporary `fly proxy` instead of trying
to connect to it directly or sourcing `packages/db/.env.production`.

1. Verify the authenticated Fly account and the target app before connecting:

   ```bash
   fly auth whoami
   fly status -a hominem-db
   ```

2. Start a proxy to the explicitly named production database. Use an unused
   local port if `15432` is taken:

   ```bash
   fly proxy 15432:5432 -a hominem-db
   ```

   Keep this process running while the database client is connected. The
   database password lives in Fly secrets / your password manager, never in the
   repo. Treat it as a secret: do not paste it into chat, logs, committed files,
   or shell command history. The connection URL is
   `postgresql://postgres:<password>@localhost:15432/hominem`.

3. In a second terminal, enter the URL without echoing it or saving it
   to shell history, then start `psql` with read-only defaults:

   ```bash
   bash -c 'read -rsp "Temporary tunnel URL: " DATABASE_URL; printf "\\n"; export DATABASE_URL; PGOPTIONS="-c default_transaction_read_only=on" psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1'
   ```

   For each inspection, use an explicit read-only transaction and roll it back:

   ```sql
   BEGIN READ ONLY;
   SELECT current_database(), current_user;
   -- Run the bounded inspection query here.
   ROLLBACK;
   ```

   Keep results to the minimum needed for the task. Do not run migrations,
   imports, updates, deletes, or other writes through this read-only workflow.
   Production writes and maintenance have separate backup and approval gates in
   the database skill.

4. Exit `psql` and stop the proxy with `Ctrl+C`. The URL stays inside
   the short-lived shell and should not be reused.

## Query and data boundaries

- Use `@hominem/db` repositories in server-owned application code; do not put
  direct SQL or database credentials in clients.
- Scope production queries to the intended user or tenant. Do not dump full
  tables when a bounded query will answer the question.
- Never run tests against production. Tests use the test database with
  migrations applied.
- Before any schema or production data mutation, read the
  [`hominem-database` skill](../.agents/skills/hominem-database/SKILL.md) and
  follow its migration, backup, and verification requirements.
