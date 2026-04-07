function getSpanContextForLogs(): { trace_id?: string; span_id?: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    const { context, trace } = require('@opentelemetry/api') as {
      context: { active: () => unknown };
      trace: {
        getSpan: (
          activeContext: unknown,
        ) =>
          | { spanContext: () => { isValid: boolean; traceId: string; spanId: string } }
          | undefined;
      };
    };
    const currentSpan = trace.getSpan(context.active());

    if (currentSpan) {
      const spanContext = currentSpan.spanContext();
      if (spanContext.isValid) {
        return {
          trace_id: spanContext.traceId,
          span_id: spanContext.spanId,
        };
      }
    }
  } catch {
    // OTel is optional in local development and tests.
  }

  return {};
}

export function buildVoiceLogData(requestId: string, data?: object) {
  return {
    requestId,
    ...getSpanContextForLogs(),
    ...(data ?? {}),
  };
}
