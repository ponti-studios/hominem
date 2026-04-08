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
