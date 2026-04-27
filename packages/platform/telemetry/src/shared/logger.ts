import { context as otelContext } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';

import { LOG_MESSAGES, type LogMessage } from './log-messages';
import {
  getHttpRequestInLogMessage,
  getHttpRequestLogLevel,
  getHttpRequestOutLogMessage,
} from './logger-shared';

export {
  LOG_MESSAGES,
  getHttpRequestInLogMessage,
  getHttpRequestLogLevel,
  getHttpRequestOutLogMessage,
};
export { type LogMessage };

const redactFields = ['email', 'password', 'token'];
const defaultServiceName = process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || 'app';

function redactObject<T extends object | undefined>(value: T): T {
  if (!value) {
    return value;
  }

  const redacted = Object.fromEntries(
    Object.entries(value).map(([key, currentValue]) => {
      if (redactFields.includes(key.toLowerCase())) {
        return [key, '[REDACTED]'];
      }

      return [key, currentValue];
    }),
  );

  return redacted as T;
}

function formatMessage(level: string, message: string, data?: object) {
  const time = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const serviceName = defaultServiceName;
  const payload = data ? ` ${JSON.stringify(redactObject(data))}` : '';
  return `[${serviceName}][${time}][${level}] ${message}${payload}`;
}

const pinoLogger = {
  info: (data: object | undefined, message: string) => {
    console.info(formatMessage('info', message, data));
  },
  error: (error: Error | object | undefined, message: string) => {
    console.error(
      formatMessage('error', message, error ? { error: redactObject(error as object) } : undefined),
    );
  },
  warn: (data: object | undefined, message: string) => {
    console.warn(formatMessage('warn', message, data));
  },
  debug: (data: object | undefined, message: string) => {
    console.debug(formatMessage('debug', message, data));
  },
};

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
