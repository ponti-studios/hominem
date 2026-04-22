/**
 * Main telemetry package exports
 */

export {
  ATTRIBUTE_VALUES,
  createResource,
  DB_ATTRIBUTES,
  DEFAULT_OTLP_ENDPOINT,
  DEFAULT_SAMPLING_RATIO,
  getHttpRequestInLogMessage,
  getHttpRequestLogLevel,
  getHttpRequestOutLogMessage,
  // Logging utilities
  getSpanContextForLogs,
  getTelemetryConfig,
  // Semantic conventions
  HTTP_ATTRIBUTES,
  LOG_MESSAGES,
  logger,
  MESSAGING_ATTRIBUTES,
  // Context keys
  TELEMETRY_CONTEXT_KEYS,
  type LogMessage,
  // Configuration
  type TelemetryConfig,
} from './shared';
