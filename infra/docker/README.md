# Docker Development Environment

## Quick Start

### Development (with persistence)
```bash
docker compose -f infra/docker/compose/base.yml -f infra/docker/compose/dev.yml up -d
```

### Observability
```bash
make obs-up
```

### Test (ephemeral)
```bash
docker compose -f infra/docker/compose/test.yml up -d
docker compose -f infra/docker/compose/test.yml down -v  # Clean up
```

## Full Documentation

- **[Canonical Docker Skill](../../.github/skills/docker-workflow/SKILL.md)** - Current Docker source of truth
- **[Canonical Setup Skill](../../.github/skills/setup-workflow/SKILL.md)** - Repo-level local setup and daily workflow
- **[Canonical Deployment Skill](../../.github/skills/deployment-workflow/SKILL.md)** - Repo-level production and release guidance

## Services

| Service | Port | Purpose |
|---------|------|---------|
| db | 5434 | Main PostgreSQL database |
| db-test | 4433 | Ephemeral test database |
| redis | 6379 | Cache/sessions |

## PostgreSQL 18

This setup uses PostgreSQL 18.3 with:
- pgvector 0.8.2
- PostGIS 3.6.2
- pgrouting 4.0.1


## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| POSTGRES_PASSWORD | postgres | Database password |
| POSTGRES_USER | postgres | Database user |
| POSTGRES_DB | hominem | Database name |

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
docker-compose logs db
```

### "Old PostgreSQL data" error
PG18 requires mounting to `/var/lib/postgresql`, not `/var/lib/postgresql/data`. Remove old volumes:
```bash
docker-compose down -v
```

### Extensions not available
- Ensure migrations run on startup.
