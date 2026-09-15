#!/usr/bin/env bash
# Public Maestro entry point. It reuses the installed development client but
# owns Metro for the duration of the run so APP_ENV=e2e cannot be stale.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_DIR="$(cd "$APP_DIR/../.." && pwd)"
API_LOG="/tmp/omiro-e2e-api.log"
API_URL="${EXPO_PUBLIC_API_BASE_URL:-http://localhost:4040}"
METRO_LOG="/tmp/omiro-e2e-metro.log"
METRO_PORT=8082

fail() { echo "maestro setup: $*" >&2; exit 1; }

stop_process_tree() {
  local pid="$1"
  local child
  while read -r child; do
    [[ -n "$child" ]] && stop_process_tree "$child"
  done < <(pgrep -P "$pid" 2>/dev/null || true)
  kill "$pid" 2>/dev/null || true
}

api_pid=''
metro_pid=''
cleanup() {
  [[ -n "$metro_pid" ]] && stop_process_tree "$metro_pid"
  [[ -n "$api_pid" ]] && stop_process_tree "$api_pid"
  return 0
}
trap cleanup EXIT

[[ "${1:-}" == '--' ]] && shift
flow_args=()
for argument in "$@"; do
  if [[ -e "$REPO_DIR/$argument" ]]; then
    flow_args+=("$REPO_DIR/$argument")
  else
    flow_args+=("$argument")
  fi
done

if ! curl --silent --fail --max-time 2 "$API_URL/api/status" >/dev/null 2>&1; then
  [[ "$API_URL" == 'http://localhost:4040' ]] || fail "API is not reachable at $API_URL"
  cd "$REPO_DIR"
  ENV=scripted pnpm --filter @hominem/api dev:app >"$API_LOG" 2>&1 &
  api_pid=$!
  for _ in {1..60}; do
    curl --silent --fail --max-time 2 "$API_URL/api/status" >/dev/null 2>&1 && break
    kill -0 "$api_pid" 2>/dev/null || fail "scripted API exited; see $API_LOG"
    sleep 1
  done
  curl --silent --fail --max-time 2 "$API_URL/api/status" >/dev/null 2>&1 ||
    fail "scripted API did not become ready; see $API_LOG"
fi

cd "$APP_DIR"
APP_ENV=e2e pnpm exec expo start --dev-client --ios --clear --port "$METRO_PORT" >"$METRO_LOG" 2>&1 &
metro_pid=$!

for _ in {1..60}; do
  if curl --silent --fail "http://localhost:$METRO_PORT/status" 2>/dev/null | grep -q running; then
    "$SCRIPT_DIR/maestro-run.sh" "${flow_args[@]}"
    exit
  fi
  kill -0 "$metro_pid" 2>/dev/null || fail "Metro exited; see $METRO_LOG"
  sleep 1
done

fail "Metro did not become ready; see $METRO_LOG"
