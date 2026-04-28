import { createHash } from 'node:crypto';

import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../server';

interface AuthRateLimit {
  path: string;
  bucket: string;
  windowSec: number;
  max: number;
}

const AUTH_RATE_LIMITS: AuthRateLimit[] = [
  { path: '/api/auth/device/code', bucket: 'device-code', windowSec: 600, max: 10 },
  { path: '/api/auth/device/token', bucket: 'device-token', windowSec: 600, max: 120 },
];

async function getRedis() {
  const { redis } = await import('@hominem/services/redis');
  return redis;
}

export function authRateLimitMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const limit = AUTH_RATE_LIMITS.find((r) => r.path === c.req.path);
    if (!limit) return next();

    const forwarded = c.req.header('x-forwarded-for');
    const ip = forwarded
      ? (forwarded.split(',')[0]?.trim() ?? 'unknown')
      : (c.req.header('x-real-ip') ?? 'unknown');

    try {
      const redis = await getRedis();
      const key = `ratelimit:auth:${limit.bucket}:${createHash('sha256').update(ip).digest('hex').slice(0, 32)}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, limit.windowSec);

      c.header('X-RateLimit-Limit', String(limit.max));
      c.header('X-RateLimit-Remaining', String(Math.max(0, limit.max - count)));

      if (count > limit.max) {
        return c.json(
          { error: 'rate_limit_exceeded', message: 'Auth rate limit exceeded. Retry later.' },
          429,
        );
      }
    } catch {
      // Fail open on cache failures to preserve auth availability.
    }

    return next();
  };
}
