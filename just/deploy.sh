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

# Best effort: is Railway itself having an incident? Used only to explain a failure, never to decide
# one, and it never fails the script. Prints a one-line headline, or nothing.
railway_incident_headline() {
  curl -fsS -m 10 "${RAILWAY_STATUS_URL:-https://status.railway.com}" 2>/dev/null \
    | grep -oiE 'new builds are temporarily paused|builds? (are )?(paused|delayed|degraded)|major outage|partial outage|degraded performance' \
    | head -1 || true
}

echo "Uploading $service_name (detached)..."
up_log="$(mktemp)"
up_status=0
"$RAILWAY_BIN" up --detach --json --service "$SERVICE" >"$up_log" 2>&1 || up_status=$?
up_output="$(cat "$up_log")"
rm -f "$up_log"
if (( up_status != 0 )); then
  # The upload itself failed, so no deployment exists to poll. Say why instead of a bare exit code.
  echo "error: 'railway up' for $service_name failed with exit code $up_status. Its output:" >&2
  printf '%s\n' "${up_output:-<no output>}" | sed 's/^/  | /' >&2
  incident="$(railway_incident_headline)"
  if [[ -n "$incident" ]]; then
    echo "::error::Railway reports a platform incident (\"$incident\", https://status.railway.com). Deploying $service_name failed at upload; rerun the job once it clears." >&2
    echo "note: nothing is wrong with this commit's build; Railway said: $incident" >&2
  else
    echo "::error::Uploading $service_name to Railway failed with exit code $up_status (see the output above)." >&2
  fi
  exit 1
fi

# The detached upload returns the deployment ID — poll exactly that
# deployment so a concurrent/manual deploy for the same service can never
# be mistaken for ours. The shape is parsed defensively; when no ID is
# found, fall back to the newest deployment created after the upload
# started (same-session uploads are serialized per service).
deployment_id_from_upload() {
  printf '%s' "$up_output" | python3 -c '
import json, re, sys
raw = sys.stdin.read()
try:
    payload = json.loads(raw[raw.index("{"):raw.rindex("}") + 1])
except Exception:
    payload = None
candidates = []
if isinstance(payload, dict):
    candidates = [
        payload.get("deploymentId"),
        (payload.get("deployment") or {}).get("id") if isinstance(payload.get("deployment"), dict) else None,
        payload.get("id"),
        (payload.get("data") or {}).get("deploymentId") if isinstance(payload.get("data"), dict) else None,
    ]
for candidate in candidates:
    if isinstance(candidate, str) and re.fullmatch(r"[0-9a-f-]{8,}", candidate):
        print(candidate)
        break
'
}

TRACKED_DEPLOYMENT_ID="$(deployment_id_from_upload || true)"
export TRACKED_DEPLOYMENT_ID
if [[ -n "$TRACKED_DEPLOYMENT_ID" ]]; then
  echo "Tracking deployment $TRACKED_DEPLOYMENT_ID"
else
  echo "Upload returned no parseable deployment ID; falling back to newest-after-upload matching" >&2
fi

# Status of the tracked deployment (or, in fallback mode, the newest
# deployment for this service created at or after the upload started).
# A single poll failing (same API flakiness class that motivated the
# detach) must not fail the deploy — only consecutive failures abort.
tracked_deployment_json() {
  "$RAILWAY_BIN" deployment list --json --service "$SERVICE" --limit 10 2>/dev/null | python3 -c '
import json, os, sys
started = sys.argv[1]
tracked = os.environ.get("TRACKED_DEPLOYMENT_ID", "")
try:
    deployments = json.load(sys.stdin)
except Exception:
    sys.exit(2)
if isinstance(deployments, dict):
    deployments = deployments.get("deployments", [])
for deployment in deployments:
    if tracked and deployment.get("id") == tracked:
        print(json.dumps({"id": deployment.get("id"), "status": deployment.get("status")}))
        break
    if not tracked and deployment.get("createdAt", "") >= started:
        print(json.dumps({"id": deployment.get("id"), "status": deployment.get("status")}))
        break
' "$STARTED_AT"
}

consecutive_failures=0
poll=0
while (( poll < MAX_POLLS )); do
  poll=$((poll + 1))
  if current="$(tracked_deployment_json)"; then
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
      "$RAILWAY_BIN" logs --build --lines 100 "$deployment_id" 2>&1 >&2 || true
      "$RAILWAY_BIN" logs --lines 100 "$deployment_id" 2>&1 >&2 || true
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
