#!/usr/bin/env bash
set -euo pipefail

# End-to-end API -> worker + observability smoke flow.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/services/api"
WORKERS_DIR="$ROOT_DIR/services/workers"
API_PORT="${API_PORT:-4040}"
OTEL_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}"
CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
AUTH_E2E_SECRET_VALUE="${AUTH_E2E_SECRET:-otp-secret}"
API_LOG_FILE="${API_LOG_FILE:-/tmp/hominem-api-worker-e2e.log}"
API_PID_FILE="${API_PID_FILE:-/tmp/hominem-api-worker-e2e.pid}"
WORKERS_LOG_FILE="${WORKERS_LOG_FILE:-/tmp/hominem-workers-worker-e2e.log}"
WORKERS_PID_FILE="${WORKERS_PID_FILE:-/tmp/hominem-workers-worker-e2e.pid}"
START_API="${START_API:-1}"
START_WORKERS="${START_WORKERS:-1}"

cleanup() {
  if [ "${START_API}" = "1" ] && [ -f "$API_PID_FILE" ]; then
    local pid
    pid="$(cat "$API_PID_FILE")"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$API_PID_FILE"
  fi

  if [ "${START_WORKERS}" = "1" ] && [ -f "$WORKERS_PID_FILE" ]; then
    local pid
    pid="$(cat "$WORKERS_PID_FILE")"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$WORKERS_PID_FILE"
  fi
}

trap cleanup EXIT

echo "==> Starting local infra"
docker compose -f "$ROOT_DIR/infra/docker/compose/base.yml" -f "$ROOT_DIR/infra/docker/compose/dev.yml" up -d --no-build redis db

echo "==> Ensuring local observability stack is available"
if curl -fsS http://localhost:8080/api/health >/dev/null 2>&1 \
  && curl -fsS http://localhost:13133/ >/dev/null 2>&1 \
  && curl -fsS http://localhost:8123/ping >/dev/null 2>&1; then
  echo "Observability stack is already running; reusing it."
else
  docker compose -f "$ROOT_DIR/infra/docker/compose/base.yml" -f "$ROOT_DIR/infra/docker/compose/observability.yml" up -d --wait
fi

if [ "$START_API" = "1" ]; then
  echo "==> Starting API with OTLP export pointed at $OTEL_ENDPOINT"
  rm -f "$API_LOG_FILE" "$API_PID_FILE"

  (
    cd "$API_DIR"
    AUTH_E2E_SECRET="$AUTH_E2E_SECRET_VALUE" \
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

if [ "$START_WORKERS" = "1" ]; then
  echo "==> Starting workers with OTLP export pointed at $OTEL_ENDPOINT"
  rm -f "$WORKERS_LOG_FILE" "$WORKERS_PID_FILE"

  (
    cd "$WORKERS_DIR"
    OTEL_EXPORTER_OTLP_ENDPOINT="$OTEL_ENDPOINT" \
      OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf" \
      OTEL_METRIC_EXPORT_INTERVAL_MILLIS="1000" \
      bun src/index.ts >"$WORKERS_LOG_FILE" 2>&1 &
    echo $! >"$WORKERS_PID_FILE"
  )
fi

echo "==> Waiting for workers to be ready"
for _ in $(seq 1 30); do
  if [ -f "$WORKERS_LOG_FILE" ] && grep -q 'observability_smoke_worker_ready' "$WORKERS_LOG_FILE"; then
    break
  fi
  sleep 1
done

if ! [ -f "$WORKERS_LOG_FILE" ] || ! grep -q 'observability_smoke_worker_ready' "$WORKERS_LOG_FILE"; then
  echo "Workers did not become ready in time."
  echo "Inspect: $WORKERS_LOG_FILE"
  exit 1
fi

flow_id="worker-flow-$(date +%s)-$(openssl rand -hex 4)"

echo "==> Enqueuing a worker smoke job through the API"
FLOW_ID="$flow_id" AUTH_E2E_SECRET="$AUTH_E2E_SECRET_VALUE" API_PORT="$API_PORT" bun -e "
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import { context, propagation, trace } from '@opentelemetry/api';
import { CompositePropagator, W3CBaggagePropagator, W3CTraceContextPropagator } from '@opentelemetry/core';

const provider = new BasicTracerProvider();
trace.setGlobalTracerProvider(provider);
propagation.setGlobalPropagator(new CompositePropagator({
  propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
}));

const tracer = trace.getTracer('worker-e2e-script');

await tracer.startActiveSpan('worker-e2e.client', async (span) => {
  const carrier = {};
  const spanContext = trace.setSpan(context.active(), span);
  propagation.inject(spanContext, carrier, {
    set: (target, key, value) => {
      target[key] = value;
    },
  });

  const response = await fetch(
    'http://localhost:' + process.env.API_PORT + '/api/observability/worker-smoke',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-e2e-auth-secret': process.env.AUTH_E2E_SECRET || 'otp-secret',
        ...carrier,
      },
      body: JSON.stringify({
        flowId: process.env.FLOW_ID,
        payload: 'observability worker smoke payload',
      }),
    },
  );

  const body = await response.text();
  console.log(JSON.stringify({
    traceId: span.spanContext().traceId,
    flowId: process.env.FLOW_ID,
    status: response.status,
    body,
  }));
  span.end();
});
" > /tmp/hominem-worker-e2e-enqueue.json

echo "==> Waiting for traces to land in ClickHouse"
trace_id="$(python - <<'PY'
import json
with open('/tmp/hominem-worker-e2e-enqueue.json') as f:
    print(json.load(f)['traceId'])
PY
)"

trace_query="SELECT ServiceName, SpanName, TraceId, ParentSpanId, SpanAttributes, Timestamp FROM default.otel_traces WHERE Timestamp > now() - INTERVAL 5 MINUTE AND (TraceId = '${trace_id}' OR SpanAttributes['messaging.message.conversation_id'] = '${flow_id}') ORDER BY Timestamp DESC LIMIT 100 FORMAT JSONEachRow"

trace_rows=""
for _ in $(seq 1 20); do
  trace_rows="$(curl -fsS --get --data-urlencode "query=${trace_query}" "$CLICKHOUSE_URL/")"
  if [ -n "$trace_rows" ]; then
    break
  fi
  sleep 1
done

if [ -z "$trace_rows" ]; then
  echo "No worker traces found in ClickHouse."
  echo "Inspect: $API_LOG_FILE"
  echo "Inspect: $WORKERS_LOG_FILE"
  exit 1
fi

printf '%s\n' "$trace_rows" > /tmp/hominem-worker-traces.jsonl

python - <<'PY'
import json
import sys

with open('/tmp/hominem-worker-e2e-enqueue.json') as f:
    enqueue = json.load(f)

trace_id = enqueue['traceId']
rows = []
with open('/tmp/hominem-worker-traces.jsonl') as f:
    for line in f:
        line = line.strip()
        if line:
            rows.append(json.loads(line))

api_spans = [row for row in rows if row.get('ServiceName') == 'hominem-api' and row.get('SpanName') == 'POST /api/observability/worker-smoke']
worker_spans = [row for row in rows if row.get('ServiceName') == 'hominem-workers' and row.get('SpanName') == 'bullmq.process observability-smoke']

if not api_spans:
  print('Missing API observability smoke span')
  sys.exit(1)

if not worker_spans:
    print('Missing worker BullMQ processing span')
    sys.exit(1)

if not any(row.get('TraceId') == trace_id for row in api_spans):
  print('API span is not correlated with the originating client trace')
  sys.exit(1)

if not any(row.get('TraceId') == trace_id for row in worker_spans):
    print('Worker span is not correlated with the originating client trace')
    sys.exit(1)

print('Verified client -> API -> worker trace correlation for trace', trace_id)
PY

echo "==> Done"
echo "Comments:"
echo "- The API smoke route should enqueue a BullMQ job with propagated trace context."
echo "- The worker should emit a bullmq.process observability-smoke span in the same trace as the originating smoke request."