import { logger } from '@hominem/telemetry';
import type { MiddlewareHandler } from 'hono';

function logCompletedRequest(data: {
  durationMs: number;
  method: string;
  path: string;
  status: number;
}) {
  if (data.status >= 500) {
    logger.error('http_request_completed', data);
    return;
  }

  if (data.status >= 400) {
    logger.warn('http_request_completed', data);
    return;
  }

  logger.info('http_request_completed', data);
}

export function requestLogger(): MiddlewareHandler {
  return async (c, next) => {
    const startedAt = performance.now();
    if (process.env.NODE_ENV !== 'test') {
      logger.info('http_request_started', {
        method: c.req.method,
        path: c.req.path,
      });
    }

    await next();

    if (process.env.NODE_ENV !== 'test') {
      logCompletedRequest({
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
      });
    }
  };
}
