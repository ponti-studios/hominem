import {
  getTelemetryMeter,
  getTelemetryTracer,
  recordTelemetryException,
} from '@hominem/telemetry';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { MiddlewareHandler } from 'hono';
import { routePath } from 'hono/route';

const httpTracer = getTelemetryTracer('hominem.http');

export function requestLogger(): MiddlewareHandler {
  const requestDuration = getTelemetryMeter('hominem.http').createHistogram(
    'http.server.request.duration',
    {
      description: 'Duration of inbound HTTP requests',
      unit: 's',
    },
  );

  return (c, next) =>
    httpTracer.startActiveSpan(
      'http.server',
      {
        kind: SpanKind.SERVER,
        attributes: { 'http.request.method': c.req.method },
      },
      async (span) => {
        const startedAt = performance.now();

        try {
          await next();
        } catch (error) {
          recordTelemetryException(error);
          throw error;
        } finally {
          const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
          const route = routePath(c) || 'unmatched';
          const status = c.res.status;
          if (route !== 'unmatched') span.setAttribute('http.route', route);
          span.setAttributes({
            'http.response.status_code': status,
          });
          if (status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
          span.end();
          const attributes = {
            'http.request.method': c.req.method,
            'http.route': route,
            'http.response.status_code': status,
          };
          requestDuration.record(durationMs / 1000, attributes);
        }
      },
    );
}
