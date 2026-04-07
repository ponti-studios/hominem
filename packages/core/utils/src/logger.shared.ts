export interface HttpRequestLogData {
  durationMs: number;
  method: string;
  path: string;
  status: number;
}

export interface HttpRequestStartLogData {
  method: string;
  path: string;
}

export type LoggerLevel = 'debug' | 'error' | 'info' | 'warn';

export function getHttpRequestLogLevel({ durationMs, status }: HttpRequestLogData): LoggerLevel {
  if (status >= 500) {
    return 'error';
  }

  if (durationMs >= 1000) {
    return 'warn';
  }

  return 'info';
}

export function getHttpRequestInLogMessage() {
  return 'http_request_in';
}

export function getHttpRequestOutLogMessage() {
  return 'http_request_out';
}

export function logAtLevel(
  logger: {
    error: (message: string, data?: Error | object) => void;
    warn: (message: string, data?: object) => void;
    debug: (message: string, data?: object) => void;
    info: (message: string, data?: object) => void;
  },
  level: LoggerLevel,
  message: string,
  data?: Error | object,
) {
  if (level === 'error') {
    logger.error(message, data);
    return;
  }

  if (level === 'warn') {
    logger.warn(message, data);
    return;
  }

  if (level === 'debug') {
    logger.debug(message, data);
    return;
  }

  logger.info(message, data);
}
