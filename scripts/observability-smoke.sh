#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=scripts/_lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_lib.sh"

echo "==> Validating observability compose config..."
"${COMPOSE_OBS[@]}" config >/dev/null

ensure_obs_stack

echo "==> Checking observability endpoints..."
wait_for_http "http://localhost:8080/api/health" 60 5
wait_for_http "http://localhost:13133/" 5 1
wait_for_http "http://localhost:8123/ping" 5 1
echo "All observability endpoints are healthy."

trace_suffix="$(openssl rand -hex 4)"
service_name="hominem-observability-smoke-${trace_suffix}"
span_name="smoke-span-${trace_suffix}"
trace_id="$(openssl rand -hex 16)"
span_id="$(openssl rand -hex 8)"
start_ns="$(python3 -c "import time; print(int(time.time() * 1e9))")"
end_ns="$((start_ns + 1000000))"

echo "==> Sending smoke trace to the collector..."
curl -fsS -X POST http://localhost:4318/v1/traces \
  -H 'Content-Type: application/json' \
  --data "{\"resourceSpans\":[{\"resource\":{\"attributes\":[{\"key\":\"service.name\",\"value\":{\"stringValue\":\"${service_name}\"}},{\"key\":\"deployment.environment\",\"value\":{\"stringValue\":\"local\"}}]},\"scopeSpans\":[{\"scope\":{\"name\":\"smoke\"},\"spans\":[{\"traceId\":\"${trace_id}\",\"spanId\":\"${span_id}\",\"name\":\"${span_name}\",\"kind\":1,\"startTimeUnixNano\":\"${start_ns}\",\"endTimeUnixNano\":\"${end_ns}\",\"attributes\":[{\"key\":\"smoke\",\"value\":{\"stringValue\":\"true\"}}]}]}]}]}" >/dev/null

echo "==> Waiting for trace to land in ClickHouse..."
query="SELECT count() FROM default.otel_traces WHERE ServiceName = '${service_name}' AND SpanName = '${span_name}' FORMAT TSVRaw"
count=""
for _ in $(seq 1 24); do
  count="$(curl -fsS --get --data-urlencode "query=${query}" http://localhost:8123/ 2>/dev/null || true)"
  if [ "${count}" = "1" ]; then
    echo "Smoke trace verified in ClickHouse."
    exit 0
  fi
  sleep 2
done

echo "ERROR: Smoke trace did not appear in ClickHouse within 48s." >&2
exit 1
