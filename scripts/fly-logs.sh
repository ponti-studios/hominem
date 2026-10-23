#!/usr/bin/env bash
set -euo pipefail

SERVICE_KEY="${1:-api}"
shift || true

case "$SERVICE_KEY" in
  api|worker|web|career|finance|redis) APP="hominem-$SERVICE_KEY" ;;
  workers) APP="hominem-worker" ;;
  database|db) APP="hominem-db" ;;
  *)
    echo "error: unknown service '$SERVICE_KEY' (expected api, worker, web, career, finance, redis, or database)" >&2
    exit 2
    ;;
esac

usage() {
  cat >&2 <<'USAGE'
Usage: scripts/fly-logs.sh [api|worker|web|career|finance|redis|database] [options]

Prints the recent log buffer for the matching Fly app (hominem-<service>).
Fly keeps a short buffer, so use New Relic for anything older.

Options:
  --follow       stream live logs instead of a snapshot
  --json         preserve JSON output (one object per line)
  <other>        passed straight to `fly logs`, e.g. --machine <id> or --region sjc
USAGE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

command -v fly >/dev/null || { echo 'error: fly CLI is required' >&2; exit 2; }

args=(--app "$APP")
follow=false
while (($# > 0)); do
  case "$1" in
    --follow) follow=true ;;
    *) args+=("$1") ;;
  esac
  shift
done

if [[ "$follow" == false ]]; then
  args+=(--no-tail)
fi

exec fly logs "${args[@]}"
