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
  # The scripted API takes its settings from a checked-in file, so no .env is needed.
  (set -a; source services/api/.env.scripted; set +a; exec pnpm --filter @hominem/api dev:app) >"$API_LOG" 2>&1 &
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
# The canonical Maestro runner targets the already-booted simulator itself.
# Avoid Expo's --ios device discovery here; Xcode 27's Device Hub is not yet
# recognized correctly by Expo CLI and makes Metro exit before Maestro starts.
EXPO_PUBLIC_API_BASE_URL="$API_URL" APP_ENV=e2e pnpm exec expo start --dev-client --clear --port "$METRO_PORT" >"$METRO_LOG" 2>&1 &
metro_pid=$!

# Give the e2e user a few notes so flows that open one have one.
"$SCRIPT_DIR/seed.sh" || echo 'seed failed; flows that need data may not find any' >&2

for _ in {1..60}; do
  if curl --silent --fail "http://localhost:$METRO_PORT/status" 2>/dev/null | grep -q running; then
    # Metro answers /status before it can bundle. Fetch the real bundle once (the URL comes from the
    # manifest) so the first screen the app opens is not the one that waits a minute for it.
    bundle_url="$(curl --silent -H 'expo-platform: ios' -H 'accept: application/expo+json' "http://localhost:$METRO_PORT" | jq -r '.launchAsset.url // empty')"
    [[ -n "$bundle_url" ]] && curl --silent --max-time 420 -o /dev/null "$bundle_url" || echo 'bundle warm-up skipped' >&2
    "$SCRIPT_DIR/maestro-run.sh" "${flow_args[@]}"
    exit
  fi
  kill -0 "$metro_pid" 2>/dev/null || fail "Metro exited; see $METRO_LOG"
  sleep 1
done

fail "Metro did not become ready; see $METRO_LOG"
