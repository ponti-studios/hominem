#!/usr/bin/env bash
set -euo pipefail

# End-to-end worker + observability smoke flow.
#
# What this script does:
# 1. Starts the local infra stack (Postgres, Redis).
# 2. Reuses the local observability stack when it is already running.
# 3. Starts the workers locally with OTLP export.
# 4. Adds a test job to the smart-input queue.
# 5. Verifies worker traces appear in ClickHouse.
# 6. Verifies worker spans are correlated to the originating enqueue trace.
#
# Notes:
# - Workers use BullMQ and process jobs from Redis queues.
# - The smart-input worker is the only actively imported worker.
# - We send a simple email-like content to trigger job processing.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKERS_DIR="$ROOT_DIR/services/workers"
WORKERS_PORT="${WORKERS_PORT:-4447}"
OTEL_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}"
CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
WORKERS_LOG_FILE="${WORKERS_LOG_FILE:-/tmp/hominem-workers-worker-e2e.log}"
WORKERS_PID_FILE="${WORKERS_PID_FILE:-/tmp/hominem-workers-worker-e2e.pid}"

START_WORKERS="${START_WORKERS:-1}"

cleanup() {
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

if [ "$START_WORKERS" = "1" ]; then
  echo "==> Starting workers with OTLP export pointed at $OTEL_ENDPOINT"
  rm -f "$WORKERS_LOG_FILE" "$WORKERS_PID_FILE"

  (
    cd "$WORKERS_DIR"
    OTEL_EXPORTER_OTLP_ENDPOINT="$OTEL_ENDPOINT" \
      OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf" \
      OTEL_SERVICE_NAME="hominem-workers" \
      OTEL_DEPLOYMENT_ENVIRONMENT="development" \
      OTEL_TRACES_SAMPLER_ARG="1.0" \
      bun src/index.ts >"$WORKERS_LOG_FILE" 2>&1 &
    echo $! >"$WORKERS_PID_FILE"
  )
fi

echo "==> Waiting for workers to be ready"
for _ in $(seq 1 20); do
  if curl -fsS "http://localhost:${WORKERS_PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

trace_query_id="worker-e2e-$(date +%s)"

echo "==> Adding a test job to the smart-input queue with trace context"
bun -e "
import { redis } from '@hominem/services/redis';
import { Queue } from 'bullmq';
import { context, propagation, trace } from '@opentelemetry/api';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';

const provider = new BasicTracerProvider();
trace.setGlobalTracerProvider(provider);

const queue = new Queue('smart-input', { connection: redis });
const tracer = trace.getTracer('worker-e2e-script');

await tracer.startActiveSpan('worker-e2e.enqueue', async (span) => {
  const headers = {};
  const spanContext = trace.setSpan(context.active(), span);
  propagation.inject(spanContext, headers, {
    set: (carrier, key, value) => {
      carrier[key] = value;
    },
  });

  await queue.add('test-job', {
    emailContent: 'Test email from observability worker smoke test. Writer: John Doe',
    telemetry: {
      traceparent: headers.traceparent,
      baggage: headers.baggage,
      traceQueryId: '${trace_query_id}',
    },
  });

  console.log(JSON.stringify({
    traceId: span.spanContext().traceId,
    traceQueryId: '${trace_query_id}',
  }));
  span.end();
});

await queue.close();
await redis.quit();
" > /tmp/hominem-worker-e2e-enqueue.json

echo "==> Waiting for job to be processed"
sleep 5

echo "==> Verifying traces landed in ClickHouse"

enqueue_trace_id="$(python - <<'PY'
import json
with open('/tmp/hominem-worker-e2e-enqueue.json') as f:
    print(json.load(f)['traceId'])
PY
)"

trace_query="SELECT ServiceName, SpanName, TraceId, ParentSpanId, SpanAttributes, Timestamp FROM default.otel_traces WHERE Timestamp > now() - INTERVAL 5 MINUTE AND (TraceId = '${enqueue_trace_id}' OR SpanAttributes['messaging.message.id'] != '') ORDER BY Timestamp DESC LIMIT 100 FORMAT JSONEachRow"

trace_rows=""
for _ in $(seq 1 15); do
  trace_rows="$(curl -fsS --get --data-urlencode "query=${trace_query}" "$CLICKHOUSE_URL/")"
  if [ -n "$trace_rows" ]; then
    break
  fi
  sleep 1
done

if [ -z "$trace_rows" ]; then
  echo "No traces found in ClickHouse."
  echo "If the workers failed to start, inspect:"
  echo "  Workers: $WORKERS_LOG_FILE"
  exit 1
fi

# Write trace output to temp file and parse from there to avoid shell escaping issues
echo "$trace_rows" > /tmp/trace_output.json

# Show results grouped by service
python - <<'PY'
import json
import sys

try:
    with open('/tmp/trace_output.json', 'r') as f:
        trace_rows = f.read()
except:
    print("Could not read trace output")
    sys.exit(1)

lines = trace_rows.strip().split('\n')
services = {}

for line in lines:
    if not line.strip():
        continue
    try:
        data = json.loads(line)
    except json.JSONDecodeError:
        continue
    svc = data.get('ServiceName', 'unknown')
    if svc not in services:
        services[svc] = []
    services[svc].append(data)

print("=== Traces found by service ===")
for svc, traces in services.items():
    print(f"\n{svc}: {len(traces)} spans")
    for t in traces[:3]:
        print(f"  {t.get('SpanName')} - {t.get('TraceId', '')[:16]}...")

if not services:
    print("No traces found!")
    sys.exit(1)

worker_spans = [
    t for group in services.values() for t in group
    if t.get('SpanName') == 'bullmq.process smart-input'
]
if not worker_spans:
    print('Missing worker BullMQ processing span')
    sys.exit(1)

if not any(t.get('TraceId') == '${enqueue_trace_id}' for t in worker_spans):
    print('Worker span is not correlated with the enqueue trace')
    sys.exit(1)
PY

rm -f /tmp/trace_output.json

echo "==> Done"
echo "Comments:"
echo "- Worker processing should produce a bullmq.process smart-input span in ClickHouse."
echo "- The worker span should share the same trace as the enqueue span for correlation checks."
