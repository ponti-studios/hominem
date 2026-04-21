import { context as otelContext } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import pino from 'pino';
import { Writable } from 'node:stream';

import {
  type HttpRequestLogData,
  type HttpRequestStartLogData,
  type LoggerLevel,
  getHttpRequestInLogMessage,
  getHttpRequestLogLevel,
  getHttpRequestOutLogMessage,
} from './logger-shared';
import { LOG_MESSAGES, type LogMessage } from './log-messages';

export {
  LOG_MESSAGES,
  getHttpRequestInLogMessage,
  getHttpRequestLogLevel,
  getHttpRequestOutLogMessage,
};
export type { HttpRequestLogData, HttpRequestStartLogData, LoggerLevel };
export { type LogMessage };

const redactFields = ['email', 'password', 'token'];

const isProduction = process.env.NODE_ENV === 'production';
const defaultServiceName = process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || 'app';

function createHumanReadableStream(): Writable {
  return new Writable({
    write(chunk: string, _encoding: string, callback: () => void) {
      try {
        const log = JSON.parse(chunk.toString());
        const serviceName = log.serviceName || defaultServiceName;
        const time = log.time
          ? new Date(log.time).toISOString().replace('T', ' ').slice(0, 19)
          : new Date().toISOString().replace('T', ' ').slice(0, 19);
        let message = log.msg || '';
        if (log.signal) {
          message = `${message} (${log.signal})`;
        }
        if (log.path) {
          message = `${message} ${log.method || ''} ${log.path}`;
          if (log.status) {
            message = `${message} ${log.status}`;
          }
        }
        process.stdout.write(`[${serviceName}][${time}] ${message}\n`);
      } catch {
        process.stdout.write(chunk.toString());
      }
      callback();
    },
  });
}

const pinoLogger = pino(
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
  isProduction ? undefined : createHumanReadableStream(),
);

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