#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
START_FRESH="$ROOT_DIR/scripts/with-fresh-test-db.sh"
cd "$ROOT_DIR"

make infra-up

if [ "$#" -gt 0 ]; then
  exec $START_FRESH bun run "$@" test:integration
fi

exec "$START_FRESH" bun run --filter @hominem/api test:integration
exec "$START_FRESH" bun run --filter @hominem/api test:contract
