#!/usr/bin/env bash
set -euo pipefail

# End-to-end auth + observability smoke flow.
#
# What this script does:
# 1. Starts the local infra stack needed by the auth flow (Postgres, Redis).
# 2. Reuses the local observability stack when it is already running.
#    If it is not running, the script attempts to start it.
# 3. Starts the API locally with OTLP export pointed at the collector.
# 4. Exercises the email OTP auth flow end to end:
#    - POST /api/auth/email-otp/send
#    - GET  /api/auth/test/otp/latest
#    - POST /api/auth/email-otp/verify
#    - GET  /api/auth/session
# 5. Queries ClickHouse to confirm the auth request spans were ingested.
#
# Notes:
# - This uses the local test OTP retrieval endpoint, so it expects the API env to
#   have AUTH_TEST_OTP_ENABLED=true and AUTH_E2E_SECRET set.
# - API request spans should use concrete route paths in SpanName.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/services/api"
API_PORT="${API_PORT:-4040}"
OTEL_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}"
CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
AUTH_E2E_SECRET_VALUE="${AUTH_E2E_SECRET:-otp-secret}"
API_LOG_FILE="${API_LOG_FILE:-/tmp/hominem-api-auth-e2e.log}"
API_PID_FILE="${API_PID_FILE:-/tmp/hominem-api-auth-e2e.pid}"

# Control whether this script should start and stop the API process itself.
# If you already have the API running locally, set START_API=0 and the script
# will reuse it.
START_API="${START_API:-1}"

cleanup() {
  # Only stop the API process if this script started it.
  if [ "${START_API}" = "1" ] && [ -f "$API_PID_FILE" ]; then
    local pid
    pid="$(cat "$API_PID_FILE")"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$API_PID_FILE"
  fi
}

trap cleanup EXIT

echo "==> Starting local infra"
# The email OTP auth flow only needs the main Postgres instance plus Redis.
# We intentionally skip `db-test` here because this is not running the test
# suite; it is exercising the live local API end to end.
#
# Use --no-build here so the script reuses existing local images/containers.
# That keeps this flow fast and avoids unrelated Docker rebuild work while we
# validate auth + observability behavior.
docker compose -f "$ROOT_DIR/infra/docker/compose/base.yml" -f "$ROOT_DIR/infra/docker/compose/dev.yml" up -d --no-build redis db

echo "==> Ensuring local observability stack is available"
if curl -fsS http://localhost:8080/api/health >/dev/null 2>&1 \
  && curl -fsS http://localhost:13133/ >/dev/null 2>&1 \
  && curl -fsS http://localhost:8123/ping >/dev/null 2>&1; then
  echo "Observability stack is already running; reusing it."
else
  # This mirrors the command used during local validation when the stack is not
  # already running.
  docker compose -f "$ROOT_DIR/infra/docker/compose/base.yml" -f "$ROOT_DIR/infra/docker/compose/observability.yml" up -d --wait
fi

if [ "$START_API" = "1" ]; then
  echo "==> Starting API with OTLP export pointed at $OTEL_ENDPOINT"
  rm -f "$API_LOG_FILE" "$API_PID_FILE"

  # Run the API from its own workspace so dotenv loads services/api/.env.
  (
    cd "$API_DIR"
    OTEL_EXPORTER_OTLP_ENDPOINT="$OTEL_ENDPOINT" \
      OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf" \
      OTEL_METRIC_EXPORT_INTERVAL_MILLIS="1000" \
      bun src/index.ts >"$API_LOG_FILE" 2>&1 &
    echo $! >"$API_PID_FILE"
  )
fi

echo "==> Waiting for API health on port $API_PORT"
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:${API_PORT}/api/status" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS "http://localhost:${API_PORT}/api/status" >/dev/null

# Use a unique email on each run so the flow stays isolated and easy to inspect.
email="obs-auth-$(date +%s)@example.com"

echo "==> Requesting email OTP for $email"
send_status="$({
  curl -sS \
    -o /tmp/obs-auth-send.json \
    -w '%{http_code}' \
    -X POST "http://localhost:${API_PORT}/api/auth/email-otp/send" \
    -H 'content-type: application/json' \
    --data "{\"email\":\"$email\",\"type\":\"sign-in\"}"
} )"

echo "==> Fetching the generated OTP from the local test endpoint"
otp="$({
  curl -sS \
    -H "x-e2e-auth-secret: ${AUTH_E2E_SECRET_VALUE}" \
    "http://localhost:${API_PORT}/api/auth/test/otp/latest?email=${email}" \
  | python -c 'import json,sys; print(json.load(sys.stdin)["otp"])'
} )"

echo "==> Verifying the OTP"
verify_status="$({
  curl -sS \
    -o /tmp/obs-auth-verify.json \
    -w '%{http_code}' \
    -X POST "http://localhost:${API_PORT}/api/auth/email-otp/verify" \
    -H 'content-type: application/json' \
    --data "{\"email\":\"$email\",\"otp\":\"$otp\"}"
} )"

echo "==> Extracting the bearer token returned by the verify step"
token="$({
  python - <<'PY'
import json
with open('/tmp/obs-auth-verify.json') as f:
    print(json.load(f)['accessToken'])
PY
} )"

echo "==> Calling /api/auth/session with the new bearer token"
session_status="$({
  curl -sS \
    -o /tmp/obs-auth-session.json \
    -w '%{http_code}' \
    "http://localhost:${API_PORT}/api/auth/session" \
    -H "authorization: Bearer $token"
} )"

echo "==> Auth flow result"
python - <<PY
import json
send_status = int('$send_status')
verify_status = int('$verify_status')
session_status = int('$session_status')
expected_email = '$email'
with open('/tmp/obs-auth-session.json') as f:
    session = json.load(f)
print(json.dumps({
  'send_status': send_status,
  'verify_status': verify_status,
  'session_status': session_status,
  'isAuthenticated': session.get('isAuthenticated'),
  'user_email': (session.get('user') or {}).get('email'),
  'expected_email': expected_email,
}, indent=2))
PY

echo "==> Verifying traces landed in ClickHouse"

# We match by concrete span names so the verification fails if route naming regresses.
trace_query="SELECT SpanName, TraceId, SpanAttributes, Timestamp FROM default.otel_traces WHERE ServiceName = 'hominem-api' AND SpanName IN ('GET /api/status', 'POST /api/auth/email-otp/send', 'GET /api/auth/test/otp/latest', 'POST /api/auth/email-otp/verify', 'GET /api/auth/session') ORDER BY Timestamp DESC LIMIT 20 FORMAT JSONEachRow"

trace_rows=""
for _ in $(seq 1 15); do
  trace_rows="$(curl -fsS --get --data-urlencode "query=${trace_query}" "$CLICKHOUSE_URL/")"
  if [ -n "$trace_rows" ]; then
    break
  fi
  sleep 1
done

if [ -z "$trace_rows" ]; then
  echo "No auth traces found in ClickHouse yet."
  echo "If the API failed to start, inspect: $API_LOG_FILE"
  exit 1
fi

printf '%s\n' "$trace_rows"

printf '%s\n' "$trace_rows" > /tmp/obs-auth-traces.jsonl

echo "==> Verifying correlated logs landed in ClickHouse"
log_query="SELECT Body, TraceId, SpanId, LogAttributes, TimestampTime FROM default.otel_logs WHERE ServiceName = 'hominem-api' AND Body IN ('http_request_in', 'http_request_out') ORDER BY TimestampTime DESC LIMIT 100 FORMAT JSONEachRow"

log_rows=""
for _ in $(seq 1 20); do
  log_rows="$(curl -fsS --get --data-urlencode "query=${log_query}" "$CLICKHOUSE_URL/")"
  if [ -n "$log_rows" ]; then
  break
  fi
  sleep 1
done

if [ -z "$log_rows" ]; then
  echo "No correlated logs found in ClickHouse yet."
  exit 1
fi

printf '%s\n' "$log_rows" > /tmp/obs-auth-logs.jsonl

python - <<'PY'
import json
import sys

trace_ids = set()
with open('/tmp/obs-auth-traces.jsonl') as f:
  for line in f:
    line = line.strip()
    if line:
      trace_ids.add(json.loads(line)['TraceId'])

matched = []
with open('/tmp/obs-auth-logs.jsonl') as f:
  for line in f:
    line = line.strip()
    if not line:
      continue
    row = json.loads(line)
    if row.get('TraceId') in trace_ids and row.get('SpanId'):
      matched.append(row)

if not matched:
  print('No correlated request logs matched the auth trace IDs')
  sys.exit(1)

print(json.dumps({
  'matched_logs': len(matched),
  'sample_log_bodies': sorted({row.get('Body') for row in matched if row.get('Body')})[:5],
}, indent=2))
PY

echo "==> Verifying API metrics landed in ClickHouse"
metric_counter_query="SELECT MetricName, ServiceName, Attributes, ResourceAttributes, TimeUnix FROM default.otel_metrics_sum WHERE MetricName = 'hominem_api_requests_total' ORDER BY TimeUnix DESC LIMIT 50 FORMAT JSONEachRow"
metric_histogram_query="SELECT MetricName, ServiceName, Attributes, ResourceAttributes, TimeUnix FROM default.otel_metrics_histogram WHERE MetricName = 'hominem_api_request_duration_ms' ORDER BY TimeUnix DESC LIMIT 50 FORMAT JSONEachRow"

metric_counter_rows=""
metric_histogram_rows=""
for _ in $(seq 1 80); do
  metric_counter_rows="$(curl -fsS --get --data-urlencode "query=${metric_counter_query}" "$CLICKHOUSE_URL/")"
  metric_histogram_rows="$(curl -fsS --get --data-urlencode "query=${metric_histogram_query}" "$CLICKHOUSE_URL/")"
  if [ -n "$metric_counter_rows" ] && [ -n "$metric_histogram_rows" ]; then
  break
  fi
  sleep 1
done

if [ -z "$metric_counter_rows" ] || [ -z "$metric_histogram_rows" ]; then
  echo "API metrics were not visible in ClickHouse yet."
  exit 1
fi

printf '%s\n' "$metric_counter_rows" > /tmp/obs-auth-metrics-sum.jsonl
printf '%s\n' "$metric_histogram_rows" > /tmp/obs-auth-metrics-histogram.jsonl

python - <<'PY'
import json
import sys

def load_rows(path):
  rows = []
  with open(path) as f:
    for line in f:
      line = line.strip()
      if line:
        rows.append(json.loads(line))
  return rows

def to_mapping(value):
  if isinstance(value, dict):
    return value
  if isinstance(value, str):
    try:
      return json.loads(value)
    except json.JSONDecodeError:
      return {}
  return {}

def belongs_to_api(row):
  if row.get('ServiceName') == 'hominem-api':
    return True

  resource_attributes = to_mapping(row.get('ResourceAttributes'))
  if resource_attributes.get('service.name') == 'hominem-api':
    return True

  attributes = to_mapping(row.get('Attributes'))
  return attributes.get('service.name') == 'hominem-api'

counter_rows = [row for row in load_rows('/tmp/obs-auth-metrics-sum.jsonl') if belongs_to_api(row)]
histogram_rows = [row for row in load_rows('/tmp/obs-auth-metrics-histogram.jsonl') if belongs_to_api(row)]

if not counter_rows:
  print('No hominem-api counter metric rows found')
  sys.exit(1)

if not histogram_rows:
  print('No hominem-api histogram metric rows found')
  sys.exit(1)

print(json.dumps({
  'counter_rows': len(counter_rows),
  'histogram_rows': len(histogram_rows),
}, indent=2))
PY

echo "==> Done"
echo "Comments:"
echo "- Successful auth flow should show send_status=200, verify_status=200, session_status=200, isAuthenticated=true."
echo "- API spans should now be named with concrete route paths like POST /api/auth/email-otp/send."
echo "- Request logs should carry trace IDs and span IDs for the verified auth trace."
echo "- API metrics should be visible in ClickHouse for HyperDX inspection."
