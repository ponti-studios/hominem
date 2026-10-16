#!/usr/bin/env bash
# One-time (and repeatable) setup for working on Omiro in any checkout or git worktree:
# dependencies, workspace packages the app imports, and the scripted API's own database.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO_DIR="$(cd "$APP_DIR/../.." && pwd)"
ENV_FILE="$REPO_DIR/services/api/.env.scripted"
note() { printf '\n==> %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

cd "$REPO_DIR"
note 'Dependencies'
pnpm install --frozen-lockfile

# Metro resolves these through their built output, so a fresh checkout cannot bundle without them.
note 'Workspace packages the app imports'
# "..." builds the package's own workspace dependencies first (auth imports @hominem/utils).
pnpm --filter "@ponti-studios/auth..." build

note 'App environment'
env_local="$APP_DIR/.env.development.local"
if grep -qs '^EXPO_PUBLIC_API_BASE_URL=' "$APP_DIR"/.env* 2>/dev/null; then
  echo 'EXPO_PUBLIC_API_BASE_URL is already set in an apps/omiro/.env file; leaving it'
else
  echo 'EXPO_PUBLIC_API_BASE_URL=http://localhost:4040' >>"$env_local"
  echo "wrote $env_local (points the dev app at the local API)"
fi

note "Scripted API database"
[[ -f "$ENV_FILE" ]] || fail "$ENV_FILE is missing"
set -a; source "$ENV_FILE"; set +a
db_name="${DATABASE_URL##*/}"
admin_url="${DATABASE_URL%/*}/postgres"
command -v psql >/dev/null || fail 'psql is missing (brew install libpq).'
export PGOPTIONS='--client-min-messages=error'
psql "$admin_url" -Atc "select 1" >/dev/null 2>&1 ||
  fail "Postgres is not reachable at ${admin_url%%@*}@… Start the Docker services (foundation-db on port 5434)."
if [[ "$(psql "$admin_url" -Atc "select 1 from pg_database where datname='$db_name'")" != 1 ]]; then
  # template0, because template1 in the shared Docker Postgres has an out-of-date collation version.
  psql "$admin_url" -c "create database \"$db_name\" template template0" >/dev/null
  echo "created database $db_name"
fi
just db migrate

note 'Done'
echo 'Next: just mobile doctor, then just mobile sim (first time) and just mobile e2e.'
