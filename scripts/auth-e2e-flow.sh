#!/usr/bin/env bash
set -euo pipefail

# End-to-end auth + observability smoke flow.
#
# What this validates:
#   1. Email OTP auth flow (send → retrieve → verify → session)
#   2. Auth request spans landed in ClickHouse (traces)
#   3. Request logs are correlated with trace IDs (logs)
#   4. API request metrics are visible (metrics)
#
# Required env vars in services/api/.env:
#   AUTH_TEST_OTP_ENABLED=true
#   AUTH_E2E_SECRET=<value matching AUTH_E2E_SECRET below>

# shellcheck source=scripts/_lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_lib.sh"

API_DIR="$ROOT_DIR/services/api"
API_PORT="${API_PORT:-4040}"
OTEL_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}"
CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
AUTH_E2E_SECRET_VALUE="${AUTH_E2E_SECRET:-otp-secret}"
API_LOG_FILE="${API_LOG_FILE:-/tmp/hominem-api-auth-e2e.log}"
API_PID_FILE="${API_PID_FILE:-/tmp/hominem-api-auth-e2e.pid}"
START_API="${START_API:-1}"

cleanup() {
  [ "${START_API}" = "1" ] && stop_service "API" "$API_PID_FILE"
}
trap cleanup EXIT

ensure_dev_infra redis db
ensure_obs_stack

if [ "$START_API" = "1" ]; then
  start_service_bg "API" "$API_DIR" "$API_LOG_FILE" "$API_PID_FILE" \
    "AUTH_E2E_SECRET=$AUTH_E2E_SECRET_VALUE" \
    "OTEL_EXPORTER_OTLP_ENDPOINT=$OTEL_ENDPOINT" \
    "OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf" \
    "OTEL_METRIC_EXPORT_INTERVAL_MILLIS=1000"
fi

echo "==> Waiting for API on port $API_PORT..."
wait_for_http "http://localhost:${API_PORT}/api/status" 30 1

email="obs-auth-$(date +%s)@example.com"

echo "==> Sending OTP to $email..."
send_status="$(curl -sS -o /tmp/obs-auth-send.json -w '%{http_code}' \
  -X POST "http://localhost:${API_PORT}/api/auth/email-otp/send" \
  -H 'content-type: application/json' \
  --data "{\"email\":\"$email\",\"type\":\"sign-in\"}")"
[ "$send_status" = "200" ] || { echo "ERROR: OTP send returned $send_status"; cat /tmp/obs-auth-send.json; exit 1; }

echo "==> Fetching generated OTP..."
otp="$(curl -fsS \
  -H "x-e2e-auth-secret: ${AUTH_E2E_SECRET_VALUE}" \
  "http://localhost:${API_PORT}/api/auth/test/otp/latest?email=${email}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["otp"])')"

echo "==> Verifying OTP..."
verify_status="$(curl -sS -o /tmp/obs-auth-verify.json -w '%{http_code}' \
  -X POST "http://localhost:${API_PORT}/api/auth/email-otp/verify" \
  -H 'content-type: application/json' \
  --data "{\"email\":\"$email\",\"otp\":\"$otp\"}")"
[ "$verify_status" = "200" ] || { echo "ERROR: OTP verify returned $verify_status"; cat /tmp/obs-auth-verify.json; exit 1; }

token="$(python3 -c "import json; print(json.load(open('/tmp/obs-auth-verify.json'))['accessToken'])")"

echo "==> Calling /api/auth/session..."
session_status="$(curl -sS -o /tmp/obs-auth-session.json -w '%{http_code}' \
  "http://localhost:${API_PORT}/api/auth/session" \
  -H "authorization: Bearer $token")"
[ "$session_status" = "200" ] || { echo "ERROR: session returned $session_status"; cat /tmp/obs-auth-session.json; exit 1; }

python3 - <<PY
import json
session = json.load(open('/tmp/obs-auth-session.json'))
assert session.get('isAuthenticated'), "Expected isAuthenticated=true"
assert (session.get('user') or {}).get('email') == '$email', "Session email mismatch"
print("Auth flow: OK")
PY

echo "==> Waiting for auth traces in ClickHouse..."
trace_query="SELECT SpanName, TraceId, SpanAttributes, Timestamp FROM default.otel_traces \
WHERE ServiceName = 'hominem-api' \
AND SpanName IN ('GET /api/status','POST /api/auth/email-otp/send','GET /api/auth/test/otp/latest','POST /api/auth/email-otp/verify','GET /api/auth/session') \
ORDER BY Timestamp DESC LIMIT 20 FORMAT JSONEachRow"
trace_rows="$(poll_clickhouse "$CLICKHOUSE_URL" "$trace_query" 15 2)" \
  || { echo "ERROR: No auth traces in ClickHouse. API log: $API_LOG_FILE" >&2; exit 1; }
printf '%s\n' "$trace_rows" >/tmp/obs-auth-traces.jsonl
echo "Traces: OK"

echo "==> Waiting for correlated logs in ClickHouse..."
log_query="SELECT Body, TraceId, SpanId, LogAttributes, TimestampTime FROM default.otel_logs \
WHERE ServiceName = 'hominem-api' \
AND Body IN ('http_request_in','http_request_out') \
ORDER BY TimestampTime DESC LIMIT 100 FORMAT JSONEachRow"
log_rows="$(poll_clickhouse "$CLICKHOUSE_URL" "$log_query" 20 1)" \
  || { echo "ERROR: No correlated logs in ClickHouse." >&2; exit 1; }
printf '%s\n' "$log_rows" >/tmp/obs-auth-logs.jsonl

python3 - <<'PY'
import json, sys
trace_ids = {json.loads(l)['TraceId'] for l in open('/tmp/obs-auth-traces.jsonl') if l.strip()}
matched = [json.loads(l) for l in open('/tmp/obs-auth-logs.jsonl') if l.strip()
           and json.loads(l).get('TraceId') in trace_ids and json.loads(l).get('SpanId')]
if not matched:
    print("ERROR: No request logs correlated with auth trace IDs", file=sys.stderr); sys.exit(1)
print(f"Logs: OK ({len(matched)} correlated)")
PY

echo "==> Waiting for API metrics in ClickHouse..."
counter_query="SELECT MetricName FROM default.otel_metrics_sum \
WHERE MetricName = 'hominem_api_requests_total' LIMIT 1 FORMAT TSVRaw"
histogram_query="SELECT MetricName FROM default.otel_metrics_histogram \
WHERE MetricName = 'hominem_api_request_duration_ms' LIMIT 1 FORMAT TSVRaw"
poll_clickhouse "$CLICKHOUSE_URL" "$counter_query" 80 1 >/dev/null \
  || { echo "ERROR: Counter metric not visible in ClickHouse." >&2; exit 1; }
poll_clickhouse "$CLICKHOUSE_URL" "$histogram_query" 10 1 >/dev/null \
  || { echo "ERROR: Histogram metric not visible in ClickHouse." >&2; exit 1; }
echo "Metrics: OK"

echo ""
echo "==> All checks passed."
