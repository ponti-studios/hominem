#!/usr/bin/env bash
# Deploy a Railway service without attaching to the log stream, then poll the
# deployment to its terminal status.
#
# Background: `railway up --ci` streams build logs and exits non-zero when the
# stream breaks ("Failed to retrieve build log") even though the deployment
# itself keeps going server-side. That conflates a log-API flake with a failed
# deploy and reds the workflow for a deployment that actually succeeds. This
# script uploads detached and polls `deployment list` instead, so the exit
# code reflects the deployment's terminal status. Build logs are fetched only
# for diagnostics when the deployment actually fails.
#
# Polling is tunable for tests via RAILWAY_POLL_INTERVAL_SECS and
# RAILWAY_MAX_POLLS (defaults: 15s x 100 ≈ 25min, inside the 30min job cap).
set -euo pipefail

service_name="${1:-}"
CONFIG="${2:-}"

case "$service_name" in api|career|web|workers|finance) ;; *) echo "error: unknown Railway service '$service_name'" >&2; exit 1 ;; esac
[[ -n "${CONFIG:-}" ]] || { echo 'error: config path required' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

[[ -f "$SCRIPT_DIR/$CONFIG" ]] || { echo "error: Railway config not found: $CONFIG" >&2; exit 1; }
SERVICE="${SERVICE:-$service_name}"
[[ -n "${RAILWAY_TOKEN:-}" ]] || { echo 'error: RAILWAY_TOKEN must be set' >&2; exit 1; }
[[ ! -e "$SCRIPT_DIR/railway.json" ]] || { echo 'error: railway.json already exists at the repository root' >&2; exit 1; }

cp "$SCRIPT_DIR/$CONFIG" "$SCRIPT_DIR/railway.json"
trap 'rm -f "$SCRIPT_DIR/railway.json"' EXIT

RAILWAY_VERSION="5.25.1"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) RAILWAY_TRIPLE="x86_64-unknown-linux-gnu" ;;
  Linux-aarch64) RAILWAY_TRIPLE="aarch64-unknown-linux-musl" ;;
  Darwin-arm64) RAILWAY_TRIPLE="aarch64-apple-darwin" ;;
  Darwin-x86_64) RAILWAY_TRIPLE="x86_64-apple-darwin" ;;
  *) echo "error: unsupported platform for the railway CLI" >&2; exit 1 ;;
esac

RAILWAY_BIN_DIR="$HOME/.railway/bin"
RAILWAY_BIN="$RAILWAY_BIN_DIR/railway"
if [[ ! -x "$RAILWAY_BIN" ]]; then
  mkdir -p "$RAILWAY_BIN_DIR"
  curl -fsSL -o /tmp/railway.tar.gz \
    "https://github.com/railwayapp/cli/releases/download/v${RAILWAY_VERSION}/railway-v${RAILWAY_VERSION}-${RAILWAY_TRIPLE}.tar.gz"
  tar xzf /tmp/railway.tar.gz -C "$RAILWAY_BIN_DIR"
  rm -f /tmp/railway.tar.gz
fi

POLL_INTERVAL="${RAILWAY_POLL_INTERVAL_SECS:-15}"
MAX_POLLS="${RAILWAY_MAX_POLLS:-100}"
CONSECUTIVE_FAILURE_LIMIT=10

cd "$SCRIPT_DIR"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "Uploading $service_name (detached)..."
"$RAILWAY_BIN" up --detach --service "$SERVICE" 2>&1 | tee /tmp/railway-up.log

# Newest deployment for this service created at or after the upload started.
# A single poll failing (same log-API flakiness class that motivated the
# detach) must not fail the deploy — only consecutive failures abort.
latest_deployment_json() {
  "$RAILWAY_BIN" deployment list --json --service "$SERVICE" --limit 10 2>/dev/null | python3 -c '
import json, sys
started = sys.argv[1]
try:
    deployments = json.load(sys.stdin)
except Exception:
    sys.exit(2)
if isinstance(deployments, dict):
    deployments = deployments.get("deployments", [])
for deployment in deployments:
    created = deployment.get("createdAt", "")
    if created >= started:
        print(json.dumps({"id": deployment.get("id"), "status": deployment.get("status")}))
        break
' "$STARTED_AT"
}

consecutive_failures=0
poll=0
while (( poll < MAX_POLLS )); do
  poll=$((poll + 1))
  if current="$(latest_deployment_json)"; then
    consecutive_failures=0
  else
    consecutive_failures=$((consecutive_failures + 1))
    if (( consecutive_failures >= CONSECUTIVE_FAILURE_LIMIT )); then
      echo "error: could not list deployments $consecutive_failures times in a row; aborting" >&2
      exit 1
    fi
    sleep "$POLL_INTERVAL"
    continue
  fi
  if [[ -z "$current" ]]; then
    sleep "$POLL_INTERVAL"
    continue
  fi
  deployment_id="$(printf '%s' "$current" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
  status="$(printf '%s' "$current" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')"
  echo "Deployment $deployment_id: $status (poll $poll/$MAX_POLLS)"
  case "$status" in
    SUCCESS)
      echo "Deployment $deployment_id of $service_name reached SUCCESS"
      exit 0
      ;;
    FAILED|CRASHED)
      echo "Deployment $deployment_id of $service_name reached $status; fetching diagnostics..." >&2
      "$RAILWAY_BIN" logs --build "$deployment_id" 2>&1 | tail -n 100 >&2 || true
      "$RAILWAY_BIN" logs "$deployment_id" 2>&1 | tail -n 100 >&2 || true
      exit 1
      ;;
    REMOVED|REMOVING|SKIPPED|SLEEPING)
      echo "error: deployment $deployment_id ended as $status (superseded?); inspect the Railway dashboard" >&2
      exit 1
      ;;
  esac
  sleep "$POLL_INTERVAL"
done

echo "error: deployment of $service_name did not reach a terminal status within $MAX_POLLS polls" >&2
exit 1
