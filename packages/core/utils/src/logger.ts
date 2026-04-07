import { context as otelContext } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';

import {
  type HttpRequestLogData,
  type HttpRequestStartLogData,
  type LoggerLevel,
  getHttpRequestInLogMessage,
  getHttpRequestLogLevel,
  getHttpRequestOutLogMessage,
  logAtLevel,
} from './logger.shared';

type PinoInstance = ((
  options: object,
  transport?: unknown,
) => {
  info: (data: object | undefined, message: string) => void;
  error: (error: Error | object | undefined, message: string) => void;
  warn: (data: object | undefined, message: string) => void;
  debug: (data: object | undefined, message: string) => void;
}) & {
  transport: (options: object) => unknown;
};

let pino: PinoInstance | null = null;

// Only import and initialize in Node.js environment
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  try {
    // Using require for Node.js environments
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    pino = require('pino');
  } catch {
    // Fallback if require is not available
    pino = null;
  }
}

const redactFields = ['email', 'password', 'token'];
const isPrettyLoggingEnabled =
  typeof process !== 'undefined' &&
  process.env &&
  process.env.NODE_ENV !== 'production' &&
  process.env.NODE_ENV !== 'test';

export { getHttpRequestInLogMessage, getHttpRequestLogLevel, getHttpRequestOutLogMessage };
export type { HttpRequestLogData, HttpRequestStartLogData, LoggerLevel };

const transport =
  pino !== null && isPrettyLoggingEnabled
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          messageFormat: '{msg}',
          singleLine: true,
          translateTime: 'SYS:standard',
        },
      })
    : undefined;

const pinoLogger =
  pino !== null
    ? pino(
        {
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
        },
        transport,
      )
    : null;

function toOtelAttributes(data?: object): OTelLogAttributes | undefined {
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
    const logger = logs.getLogger('hominem-pino-bridge');
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
    if (pinoLogger) pinoLogger.info(data, message);
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
    if (pinoLogger) pinoLogger.error(error, message);
  },
  warn: (message: string, data?: object) => {
    emitOtelLogRecord('WARN', message, data);
    if (pinoLogger) pinoLogger.warn(data, message);
  },
  debug: (message: string, data?: object) => {
    emitOtelLogRecord('DEBUG', message, data);
    if (pinoLogger) pinoLogger.debug(data, message);
  },
};
