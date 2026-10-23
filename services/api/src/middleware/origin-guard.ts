import { timingSafeEqual } from 'node:crypto';

import { logger } from '@hominem/telemetry';
import type { MiddlewareHandler } from 'hono';

export const ORIGIN_SECRET_HEADER = 'x-origin-secret';
const HEALTH_PATH = '/healthz';

function secretsMatch(given: string | undefined, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Cloudflare adds X-Origin-Secret to every request it proxies to api.ponti.io. Anything else,
// like a visitor going straight to hominem-api.fly.dev, never has it and gets a 403, so the WAF
// and rate limits can't be walked around. Requests over Fly's private network (*.internal, used
// by the SSR apps) and the Fly health check are exempt. Off when ORIGIN_SECRET is unset.
export function originGuard(secret: string): MiddlewareHandler {
  return async (c, next) => {
    if (!secret || c.req.path === HEALTH_PATH) return next();

    const host = (c.req.header('host') ?? '').split(':')[0] ?? '';
    if (host.endsWith('.internal')) return next();

    if (!secretsMatch(c.req.header(ORIGIN_SECRET_HEADER), secret)) {
      logger.warn('origin_guard_rejected', {
        failureType: 'request.origin_guard_rejected',
        path: c.req.path,
        method: c.req.method,
        statusCode: 403,
      });
      return c.text('Forbidden', 403);
    }
    return next();
  };
}
