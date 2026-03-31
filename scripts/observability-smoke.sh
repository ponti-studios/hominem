#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -f "$ROOT_DIR/infra/docker/compose/base.yml" -f "$ROOT_DIR/infra/docker/compose/observability.yml")

echo "Validating observability compose config..."
"${COMPOSE[@]}" config >/dev/null

echo "Starting observability stack..."
if ! "${COMPOSE[@]}" ps --status running | grep -q hyperdx; then
  "${COMPOSE[@]}" up -d
fi

echo "Checking observability endpoints..."
for _ in $(seq 1 60); do
  if curl -fsS http://localhost:8080/api/health >/dev/null 2>&1; then
      echo "Observability stack is up and responding."
      break
  fi
  sleep 5
done

if ! curl -fsS http://localhost:13133/ >/dev/null 2>&1; then
  echo "OTel collector health endpoint is not responding."
  exit 1
fi

if ! curl -fsS http://localhost:8123/ping >/dev/null 2>&1; then
  echo "ClickHouse health endpoint is not responding."
  exit 1
fi

trace_suffix="$(openssl rand -hex 4)"
service_name="hominem-observability-smoke-${trace_suffix}"
span_name="smoke-span-${trace_suffix}"
trace_id="$(openssl rand -hex 16)"
span_id="$(openssl rand -hex 8)"
start_ns="$(python - <<'PY'
import time
print(int(time.time() * 1e9))
PY
)"
end_ns="$((start_ns + 1000000))"

echo "Sending smoke trace to the collector..."
curl -fsS -X POST http://localhost:4318/v1/traces \
  -H 'Content-Type: application/json' \
  --data "{\"resourceSpans\":[{\"resource\":{\"attributes\":[{\"key\":\"service.name\",\"value\":{\"stringValue\":\"${service_name}\"}},{\"key\":\"deployment.environment\",\"value\":{\"stringValue\":\"local\"}}]},\"scopeSpans\":[{\"scope\":{\"name\":\"smoke\"},\"spans\":[{\"traceId\":\"${trace_id}\",\"spanId\":\"${span_id}\",\"name\":\"${span_name}\",\"kind\":1,\"startTimeUnixNano\":\"${start_ns}\",\"endTimeUnixNano\":\"${end_ns}\",\"attributes\":[{\"key\":\"smoke\",\"value\":{\"stringValue\":\"true\"}}]}]}]}] }" >/dev/null

echo "Waiting for trace to land in ClickHouse..."
for _ in $(seq 1 24); do
  if count=$(curl -fsS --get --data-urlencode "query=SELECT count() FROM default.otel_traces WHERE ServiceName = '${service_name}' AND SpanName = '${span_name}' FORMAT TSVRaw" http://localhost:8123/ 2>/dev/null); then
    if [ "${count}" = "1" ]; then
      echo "Observability smoke trace was ingested into ClickHouse."
      exit 0
    fi
  fi
  sleep 2
done

echo "Smoke trace did not appear in ClickHouse in time."
exit 1
