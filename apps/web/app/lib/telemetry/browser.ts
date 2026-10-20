export interface BrowserTelemetry {
  shutdown(): Promise<void>;
  forceFlush(): Promise<void>;
}

// browser events go through the authenticated API proxy, so this stays a
// no-op — that way we don't need an OTLP or New Relic credential in the Web bundle
export function initTelemetry(_config?: unknown): BrowserTelemetry {
  return {
    shutdown: async () => {},
    forceFlush: async () => {},
  };
}
