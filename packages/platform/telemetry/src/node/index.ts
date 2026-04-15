/**
 * Node.js OpenTelemetry SDK initialization
 */

import { context, metrics, propagation, trace, type Span } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import { CompressionAlgorithm } from '@opentelemetry/otlp-exporter-base';

import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import type { TelemetryConfig } from '../shared/index.js';
import { createResource, getTelemetryConfig } from '../shared/index.js';

/**
 * Node telemetry SDK instance
 */
export interface NodeTelemetry {
  /** Shutdown the SDK gracefully */
  shutdown(): Promise<void>;
  /** Force flush all exporters */
  forceFlush(): Promise<void>;
}

/**
 * Initialize OpenTelemetry for Node.js services
 */
export function initTelemetry(explicitConfig?: Partial<TelemetryConfig>): NodeTelemetry {
  const config = getTelemetryConfig(explicitConfig);

  // Skip all OTel setup when explicitly disabled
  if (config.otlpEndpoint === 'none') {
    return { shutdown: async () => {}, forceFlush: async () => {} };
  }

  // Skip OTel setup in development - use pino logger directly
  if (config.environment === 'development') {
    return { shutdown: async () => {}, forceFlush: async () => {} };
  }

  const resource = createResource(config);

  // Set up context manager
  const contextManager = new AsyncHooksContextManager();
  contextManager.enable();
  context.setGlobalContextManager(contextManager);

  // Set up propagator (W3C standard for context and baggage)
  const propagator = new CompositePropagator({
    propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
  });
  propagation.setGlobalPropagator(propagator);

  // Configure OTLP endpoint
  const otlpEndpoint = config.otlpEndpoint;

  // Trace exporter and provider
  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
    compression: CompressionAlgorithm.GZIP,
  });

  const tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(traceExporter, {
        maxQueueSize: 2048,
        maxExportBatchSize: 512,
        scheduledDelayMillis: 1000,
        exportTimeoutMillis: 30000,
      }),
    ],
  });

  // Sampling based on config
  if (config.samplingRatio !== undefined && config.samplingRatio < 1.0) {
    tracerProvider.addSpanProcessor({
      forceFlush: async () => {},
      shutdown: async () => {},
      onStart: () => {},
      onEnd: (_span) => {
        // Apply sampling
      },
    } satisfies SpanProcessor);
  }

  tracerProvider.register();
  trace.setGlobalTracerProvider(tracerProvider);

  // Metrics provider
  const metricExporter = new OTLPMetricExporter({
    url: `${otlpEndpoint}/v1/metrics`,
    compression: CompressionAlgorithm.GZIP,
  });
  const metricExportIntervalMillis = config.metricExportIntervalMillis ?? 60000;
  const metricExportTimeoutMillis = Math.min(30000, metricExportIntervalMillis);

  const meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: metricExportIntervalMillis,
        exportTimeoutMillis: metricExportTimeoutMillis,
      }),
    ],
  });
  metrics.setGlobalMeterProvider(meterProvider);

  // Logs provider (optional, only if explicitly enabled)
  let loggerProvider: LoggerProvider | undefined;
  if (process.env.OTEL_LOGS_EXPORTER !== 'none') {
    const logExporter = new OTLPLogExporter({
      url: `${otlpEndpoint}/v1/logs`,
      compression: CompressionAlgorithm.GZIP,
    });

    loggerProvider = new LoggerProvider({
      resource,
    });
    loggerProvider.addLogRecordProcessor(
      new BatchLogRecordProcessor(logExporter, {
        maxQueueSize: 2048,
        maxExportBatchSize: 512,
        scheduledDelayMillis: 1000,
        exportTimeoutMillis: 30000,
      }),
    );
    logs.setGlobalLoggerProvider(loggerProvider);
  }

  // Auto-instrumentations
  registerInstrumentations({
    tracerProvider,
    meterProvider,
    instrumentations: [
      new HttpInstrumentation({
        requestHook: (span, request) => {
          if ('headers' in request) {
            span.setAttribute('http.request.headers', JSON.stringify(request.headers));
          }
        },
        responseHook: (span, response) => {
          if ('headers' in response) {
            span.setAttribute('http.response.headers', JSON.stringify(response.headers));
          }
        },
        applyCustomAttributesOnSpan: (span, _request, response) => {
          if (response && response.statusCode != null && response.statusCode >= 400) {
            span.setStatus({ code: 2, message: `HTTP ${response.statusCode}` });
          }
        },
      }),
      new PgInstrumentation({
        enhancedDatabaseReporting: true,
      }),
      new RedisInstrumentation({
        dbStatementSerializer: (cmd, args) => {
          // Sanitize potentially sensitive data
          return `${cmd} ${args?.[0] || ''}`;
        },
      }),
    ],
  });

  // Return control interface
  return {
    async shutdown(): Promise<void> {
      await tracerProvider.shutdown();
      await meterProvider.shutdown();
      if (loggerProvider) {
        await loggerProvider.shutdown();
      }
    },
    async forceFlush(): Promise<void> {
      await tracerProvider.forceFlush();
      await meterProvider.forceFlush();
      if (loggerProvider) {
        await loggerProvider.forceFlush();
      }
    },
  };
}

/**
 * Middleware for Hono framework to create spans for HTTP requests
 */
export function createHonoTelemetryMiddleware() {
  const tracer = trace.getTracer('hominem-hono');
  const meter = metrics.getMeter('hominem-hono');
  const requestCounter = meter.createCounter('hominem_api_requests_total', {
    description: 'Total API requests handled by the Hono server',
  });
  const requestDuration = meter.createHistogram('hominem_api_request_duration_ms', {
    description: 'API request duration in milliseconds',
    unit: 'ms',
  });

  return async (c: unknown, next: () => Promise<void>) => {
    const ctx = c as {
      req: {
        method: string;
        routePath?: string;
        path: string;
        url: string;
        header: (name: string) => string | undefined;
      };
      res: { status: number };
    };
    const method = ctx.req.method;
    const pathname = (() => {
      try {
        return new URL(ctx.req.url).pathname;
      } catch {
        return ctx.req.path;
      }
    })();
    const activeContext = context.active();
    const activeSpan = trace.getSpan(activeContext);
    const carrier: Record<string, string> = {};

    for (const headerName of ['traceparent', 'baggage']) {
      const value = ctx.req.header(headerName);
      if (value) {
        carrier[headerName] = value;
      }
    }

    const parentContext =
      Object.keys(carrier).length > 0
        ? propagation.extract(activeContext, carrier)
        : activeSpan
          ? activeContext
          : activeContext;
    const startedAt = performance.now();

    await tracer.startActiveSpan(
      `${method} ${pathname}`,
      {
        attributes: {
          'http.request.method': method,
          'http.route': pathname,
          'http.request.url': ctx.req.url,
          'http.client_ip':
            ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip') || 'unknown',
          'user_agent.original': ctx.req.header('user-agent') || 'unknown',
        },
      },
      parentContext,
      async (span: Span) => {
        try {
          await next();

          // Set response attributes
          span.setAttribute('http.response.status_code', ctx.res.status);
          requestCounter.add(1, {
            'http.request.method': method,
            'http.route': pathname,
            'http.response.status_code': ctx.res.status,
          });
          requestDuration.record(Math.max(0, performance.now() - startedAt), {
            'http.request.method': method,
            'http.route': pathname,
            'http.response.status_code': ctx.res.status,
          });

          if (ctx.res.status >= 400) {
            span.setStatus({ code: 2, message: `HTTP ${ctx.res.status}` });
          } else {
            span.setStatus({ code: 1 });
          }
        } catch (error) {
          requestCounter.add(1, {
            'http.request.method': method,
            'http.route': pathname,
            'http.response.status_code': 500,
          });
          requestDuration.record(Math.max(0, performance.now() - startedAt), {
            'http.request.method': method,
            'http.route': pathname,
            'http.response.status_code': 500,
          });
          span.recordException(error as Error);
          span.setStatus({ code: 2, message: (error as Error).message });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  };
}
