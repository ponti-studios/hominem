/**
 * Browser-compatible logger using native console APIs.
 * Use this in client-side code. For server-side code, use `@hakumi/utils/logger`.
 */
import {
  type HttpRequestLogData,
  type HttpRequestStartLogData,
  type LoggerLevel,
  getHttpRequestInLogMessage,
  getHttpRequestLogLevel,
  getHttpRequestOutLogMessage,
} from './logger.shared';

export { getHttpRequestInLogMessage, getHttpRequestLogLevel, getHttpRequestOutLogMessage };
export type { HttpRequestLogData, HttpRequestStartLogData, LoggerLevel };

function redactFields(data: object | undefined): object | undefined {
  if (!data || typeof data !== 'object') return data;

  const sensitiveFields = ['email', 'password', 'token'];
  const redacted = { ...data };

  for (const key of Object.keys(redacted)) {
    if (sensitiveFields.includes(key.toLowerCase())) {
      (redacted as Record<string, unknown>)[key] = '[REDACTED]';
    }
  }

  return redacted;
}

export const logger = {
  info: (message: string, data?: object) => {
    // eslint-disable-next-line no-console
    console.log(message, redactFields(data));
  },
  error: (message: string, error?: Error | object) => {
    // eslint-disable-next-line no-console
    console.error(message, redactFields(error));
  },
  warn: (message: string, data?: object) => {
    // eslint-disable-next-line no-console
    console.warn(message, redactFields(data));
  },
  debug: (message: string, data?: object) => {
    // eslint-disable-next-line no-console
    console.debug(message, redactFields(data));
  },
};
