import { context as otelContext } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import pino from 'pino';

import {
  type HttpRequestLogData,
  type HttpRequestStartLogData,
  type LoggerLevel,
  getHttpRequestInLogMessage,
  getHttpRequestLogLevel,
  getHttpRequestOutLogMessage,
} from './logger.shared';

const redactFields = ['email', 'password', 'token'];

export { getHttpRequestInLogMessage, getHttpRequestLogLevel, getHttpRequestOutLogMessage };
export type { HttpRequestLogData, HttpRequestStartLogData, LoggerLevel };

const pinoLogger = pino({
  base: null,
  level: (typeof process !== 'undefined' && process.env?.LOG_LEVEL) || 'debug',
  redact: {
    paths: redactFields.map((field) => `*.${field}`),
    censor: '[REDACTED]',
  },
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
});

function toOtelAttributes(data?: object) {
  if (!data) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return [key, value];
      }

      if (value == null) {
        return [key, undefined];
      }

      return [key, JSON.stringify(value)];
    }),
  );
}

function emitOtelLogRecord(
  severityText: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG',
  message: string,
  data?: object,
) {
  try {
    const logger = logs.getLogger('hakumi-pino-bridge');
    const attributes = toOtelAttributes(data);
    logger.emit({
      context: otelContext.active(),
      severityText,
      body: message,
      ...(attributes ? { attributes } : {}),
    });
  } catch {
    // OTel logs are optional in local development.
  }
}

export const logger = {
  info: (message: string, data?: object) => {
    emitOtelLogRecord('INFO', message, data);
    pinoLogger.info(data, message);
  },
  error: (message: string, error?: Error | object) => {
    const data =
      error instanceof Error
        ? {
            error_name: error.name,
            error_message: error.message,
            error_stack: error.stack,
          }
        : error;

    emitOtelLogRecord('ERROR', message, data as object | undefined);
    pinoLogger.error(error, message);
  },
  warn: (message: string, data?: object) => {
    emitOtelLogRecord('WARN', message, data);
    pinoLogger.warn(data, message);
  },
  debug: (message: string, data?: object) => {
    emitOtelLogRecord('DEBUG', message, data);
    pinoLogger.debug(data, message);
  },
};
