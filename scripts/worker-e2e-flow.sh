#!/usr/bin/env bash
set -euo pipefail

# End-to-end API → worker + observability smoke flow.
#
# What this validates:
#   1. API enqueues a BullMQ job with propagated W3C trace context
#   2. Worker processes the job and emits a span in the same trace
#   3. Full client → API → worker trace correlation is visible in ClickHouse

# shellcheck source=scripts/_lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_lib.sh"

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
  [ "${START_API}" = "1" ]     && stop_service "API"     "$API_PID_FILE"
  [ "${START_WORKERS}" = "1" ] && stop_service "workers" "$WORKERS_PID_FILE"
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

if [ "$START_WORKERS" = "1" ]; then
  start_service_bg "workers" "$WORKERS_DIR" "$WORKERS_LOG_FILE" "$WORKERS_PID_FILE" \
    "OTEL_EXPORTER_OTLP_ENDPOINT=$OTEL_ENDPOINT" \
    "OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf" \
    "OTEL_METRIC_EXPORT_INTERVAL_MILLIS=1000"
fi

echo "==> Waiting for workers to be ready..."
for _ in $(seq 1 30); do
  if [ -f "$WORKERS_LOG_FILE" ] && grep -q 'observability_smoke_worker_ready' "$WORKERS_LOG_FILE"; then
    break
  fi
  sleep 1
done
grep -q 'observability_smoke_worker_ready' "$WORKERS_LOG_FILE" \
  || { echo "ERROR: Workers did not become ready in time. Inspect: $WORKERS_LOG_FILE" >&2; exit 1; }

flow_id="worker-flow-$(date +%s)-$(openssl rand -hex 4)"

echo "==> Enqueuing worker smoke job via API..."
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
  propagation.inject(trace.setSpan(context.active(), span), carrier, {
    set: (t, k, v) => { t[k] = v; },
  });
  const response = await fetch(
    'http://localhost:' + process.env.API_PORT + '/api/observability/worker-smoke',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-e2e-auth-secret': process.env.AUTH_E2E_SECRET, ...carrier },
      body: JSON.stringify({ flowId: process.env.FLOW_ID, payload: 'observability worker smoke payload' }),
    },
  );
  console.log(JSON.stringify({ traceId: span.spanContext().traceId, flowId: process.env.FLOW_ID, status: response.status }));
  span.end();
});
" >/tmp/hominem-worker-e2e-enqueue.json

trace_id="$(python3 -c "import json; print(json.load(open('/tmp/hominem-worker-e2e-enqueue.json'))['traceId'])")"

echo "==> Waiting for traces in ClickHouse (trace: $trace_id)..."
trace_query="SELECT ServiceName, SpanName, TraceId, ParentSpanId, Timestamp \
FROM default.otel_traces \
WHERE Timestamp > now() - INTERVAL 5 MINUTE \
AND (TraceId = '${trace_id}' OR SpanAttributes['messaging.message.conversation_id'] = '${flow_id}') \
ORDER BY Timestamp DESC LIMIT 100 FORMAT JSONEachRow"

trace_rows="$(poll_clickhouse "$CLICKHOUSE_URL" "$trace_query" 20 2)" \
  || { echo "ERROR: No worker traces in ClickHouse. API: $API_LOG_FILE  Workers: $WORKERS_LOG_FILE" >&2; exit 1; }
printf '%s\n' "$trace_rows" >/tmp/hominem-worker-traces.jsonl

python3 - <<PY
import json, sys

trace_id = '$trace_id'
rows = [json.loads(l) for l in open('/tmp/hominem-worker-traces.jsonl') if l.strip()]

api_spans    = [r for r in rows if r.get('ServiceName') == 'hominem-api'     and r.get('SpanName') == 'POST /api/observability/worker-smoke']
worker_spans = [r for r in rows if r.get('ServiceName') == 'hominem-workers' and r.get('SpanName') == 'bullmq.process observability-smoke']

if not api_spans:    print("ERROR: Missing API smoke span",    file=sys.stderr); sys.exit(1)
if not worker_spans: print("ERROR: Missing worker BullMQ span", file=sys.stderr); sys.exit(1)
if not any(r['TraceId'] == trace_id for r in api_spans):    print("ERROR: API span not correlated with client trace",    file=sys.stderr); sys.exit(1)
if not any(r['TraceId'] == trace_id for r in worker_spans): print("ERROR: Worker span not correlated with client trace", file=sys.stderr); sys.exit(1)

print(f"Trace correlation: OK  (trace={trace_id})")
PY

echo ""
echo "==> All checks passed."
echo "- The worker should emit a bullmq.process observability-smoke span in the same trace as the originating smoke request."