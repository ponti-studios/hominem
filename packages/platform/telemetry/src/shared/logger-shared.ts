import { LOG_MESSAGES } from './log-messages';

interface HttpRequestLogData {
  durationMs: number;
  method: string;
  path: string;
  status: number;
}

type LoggerLevel = 'debug' | 'error' | 'info' | 'warn';

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
  return LOG_MESSAGES.HTTP_REQUEST_IN;
}

export function getHttpRequestOutLogMessage() {
  return LOG_MESSAGES.HTTP_REQUEST_OUT;
}
