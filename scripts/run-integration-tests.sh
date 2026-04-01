#!/usr/bin/env bash
set -euo pipefail

# Runs API integration and contract tests against a fresh test database.
# Usage:
#   make test:integration          — runs api integration + contract
#   bash scripts/run-integration-tests.sh @hominem/workers  — runs for a specific filter

# shellcheck source=scripts/_lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_lib.sh"

cd "$ROOT_DIR"

echo "==> Starting test database..."
docker compose -f infra/docker/compose/test.yml up -d --wait db-test

echo "==> Resetting and migrating test database..."
make db-reset-test

if [ "$#" -gt 0 ]; then
  exec bun run --filter "$1" test:integration
fi

bun run --filter @hominem/api test:integration
bun run --filter @hominem/api test:contract
