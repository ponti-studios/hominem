# Docker Development Environment

## Quick Start

### 1. Configure credentials (first time only)

```bash
cp infra/docker/compose/.env.example infra/docker/compose/.env
# Edit .env to customize credentials if desired
```

### 2. Development (with persistence)

```bash
docker compose -f infra/docker/compose/base.yml -f infra/docker/compose/dev.yml up -d
```

### Observability

```bash
make obs-up
```

### Test (ephemeral)

> ⚠️ Do not run simultaneously with `dev.yml` — both bind port `4433`.

```bash
docker compose -f infra/docker/compose/test.yml up -d
docker compose -f infra/docker/compose/test.yml down -v  # Clean up
```

## Full Documentation

- **[Canonical Docker Skill](../../.github/skills/docker-workflow/SKILL.md)** - Current Docker source of truth
- **[Canonical Setup Skill](../../.github/skills/setup-workflow/SKILL.md)** - Repo-level local setup and daily workflow
- **[Canonical Deployment Skill](../../.github/skills/deployment-workflow/SKILL.md)** - Repo-level production and release guidance

## Services

| Service | Port | Purpose                  |
| ------- | ---- | ------------------------ |
| db      | 5434 | Main PostgreSQL database |
| db-test | 4433 | Test database            |
| redis   | 6379 | Cache/sessions           |

## PostgreSQL 18

This setup uses PostgreSQL 18 with:

- pgvector 0.8.2
- PostGIS 3.6.2
- pgrouting 4.0.1

## Environment Variables

> ⚠️ **Security**: The defaults below are for local development only. Never use `postgres:postgres` in production.

| Variable            | Default        | Description        |
| ------------------- | -------------- | ------------------ |
| `POSTGRES_USER`     | `postgres`     | Database user      |
| `POSTGRES_PASSWORD` | `postgres`     | Database password  |
| `POSTGRES_DB`       | `hominem`      | Main database name |
| `POSTGRES_TEST_DB`  | `hominem-test` | Test database name |

Credentials are loaded from `infra/docker/compose/.env` (gitignored). Copy `.env.example` to get started.

## Backup & Restore

### Backup

```bash
docker exec hominem-postgres pg_dump -U postgres hominem > backup.sql
```

### Restore

```bash
docker exec -i hominem-postgres psql -U postgres hominem < backup.sql
```

## Troubleshooting

### Container won't start

Check logs:

```bash
docker compose logs db
```

### "Old PostgreSQL data" error

PG18 requires mounting to `/var/lib/postgresql`, not `/var/lib/postgresql/data`. Remove old volumes:

```bash
docker compose down -v
```

### Extensions not available

Ensure migrations run on startup.
