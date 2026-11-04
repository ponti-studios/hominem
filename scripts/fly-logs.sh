#!/usr/bin/env bash
set -euo pipefail

SERVICE_KEY="${1:-api}"
shift || true

case "$SERVICE_KEY" in
  api) APP="${FLY_API_APP_NAME:?Set FLY_API_APP_NAME from the private production reference}" ;;
  worker|workers) APP="${FLY_WORKER_APP_NAME:?Set FLY_WORKER_APP_NAME from the private production reference}" ;;
  web) APP="${FLY_WEB_APP_NAME:?Set FLY_WEB_APP_NAME from the private production reference}" ;;
  redis) APP="${FLY_REDIS_APP_NAME:?Set FLY_REDIS_APP_NAME from the private production reference}" ;;
  database|db) APP="${FLY_DB_APP_NAME:?Set FLY_DB_APP_NAME from the private production reference}" ;;
  career|finance)
    echo "error: $SERVICE_KEY has no production Fly app" >&2
    exit 2
    ;;
  *)
    echo "error: unknown service '$SERVICE_KEY' (expected api, worker, web, redis, or database)" >&2
    exit 2
    ;;
esac

usage() {
  cat >&2 <<'USAGE'
Usage: scripts/fly-logs.sh [api|worker|web|redis|database] [options]

Prints logs for the active Fly app for the selected service.
Fly keeps a short buffer, so use New Relic for anything older.

Options:
  --follow       stream live logs instead of a snapshot
  --json         preserve JSON output (one object per line)
  <other>        passed straight to `fly logs`, e.g. --machine <id> or --region <region>
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
