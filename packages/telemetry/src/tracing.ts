import { metrics, SpanStatusCode, trace } from '@opentelemetry/api';

export function getTelemetryTracer(scope = 'hominem') {
  return trace.getTracer(scope);
}

export function getTelemetryMeter(scope = 'hominem') {
  return metrics.getMeter(scope);
}

export function recordTelemetryException(error: unknown) {
  const span = trace.getActiveSpan();
  if (!span?.isRecording()) return;

  const name = error instanceof Error ? error.name.slice(0, 64) : 'Error';
  const stack =
    error instanceof Error ? error.stack?.split('\n').slice(1, 21).join('\n') : undefined;
  span.setAttribute('error.type', name);
  span.recordException({ name, message: 'Request failed', ...(stack ? { stack } : {}) });
  span.setStatus({ code: SpanStatusCode.ERROR });
}
