import { createHash } from 'node:crypto';

import { logger } from '@hominem/telemetry';
import type { Context, MiddlewareHandler } from 'hono';

import { getClientIp } from './client-ip';

// Bumps the counter for a key and returns the new count. The first hit in a window starts the clock.
export type RateLimitCounter = (key: string, windowSec: number) => Promise<number>;
export type BucketResult = 'allowed' | 'limited' | 'unavailable';

const INCREMENT_SCRIPT = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  return count
`;
// ioredis here retries forever, so a dead Redis would hang requests instead of failing them.
const REDIS_TIMEOUT_MS = 1000;

export const redisCounter: RateLimitCounter = async (key, windowSec) => {
  const { redis } = await import('@hominem/services/redis');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('rate limit redis timeout')), REDIS_TIMEOUT_MS);
    });
    return Number(
      await Promise.race([redis.eval(INCREMENT_SCRIPT, 1, key, String(windowSec)), timeout]),
    );
  } finally {
    clearTimeout(timer);
  }
};

export function hashKeyPart(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 32);
}

export async function checkBucket(
  counter: RateLimitCounter,
  bucket: string,
  key: string,
  limit: number,
  windowSec: number,
): Promise<BucketResult> {
  try {
    const count = await counter(`ratelimit:${bucket}:${key}`, windowSec);
    return count > limit ? 'limited' : 'allowed';
  } catch {
    return 'unavailable';
  }
}

type RateLimitOptions = {
  bucket: string;
  limit: number;
  windowSec: number;
  counter: RateLimitCounter;
  // Auth-ish buckets fail closed when Redis is down (an outage must not open the OTP/signup
  // floodgates). The global bucket fails open so a Redis blip doesn't take the whole API with it.
  failClosed?: boolean;
  key?: (c: Context) => string;
};

function tooMany(c: Context, bucket: string, windowSec: number) {
  logger.warn('rate_limited', {
    failureType: 'request.rate_limited',
    bucket,
    path: c.req.path,
    statusCode: 429,
  });
  c.header('Retry-After', String(windowSec));
  return c.json({ error: 'rate_limited', message: 'Too many requests. Slow down a bit.' }, 429);
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const { bucket, limit, windowSec, counter, failClosed = false } = options;
  return async (c, next) => {
    // Preflights and the health check shouldn't eat anyone's budget.
    if (c.req.method === 'OPTIONS' || c.req.path === '/healthz') return next();
    const key = options.key?.(c) ?? getClientIp(c);
    const result = await checkBucket(counter, bucket, key, limit, windowSec);
    if (result === 'limited') return tooMany(c, bucket, windowSec);
    if (result === 'unavailable') {
      if (failClosed) return c.json({ error: 'rate_limit_unavailable' }, 503);
      logger.warn('rate_limit_unavailable', { bucket });
    }
    return next();
  };
}

// OTP sends cost real money (Resend) and let a stranger spam someone's inbox, so they get a
// per-email cap on top of the per-IP one. The email is hashed so it never lands in Redis keys/logs.
export const OTP_LIMITS = {
  perEmail10Min: { limit: 3, windowSec: 600 },
  perEmailDay: { limit: 10, windowSec: 86_400 },
  perIpHour: { limit: 20, windowSec: 3600 },
} as const;

export async function checkOtpSendLimits(input: {
  counter: RateLimitCounter;
  email: string;
  ip: string;
}): Promise<BucketResult> {
  const email = hashKeyPart(input.email);
  const results = await Promise.all([
    checkBucket(
      input.counter,
      'otp-email-10m',
      email,
      OTP_LIMITS.perEmail10Min.limit,
      OTP_LIMITS.perEmail10Min.windowSec,
    ),
    checkBucket(
      input.counter,
      'otp-email-day',
      email,
      OTP_LIMITS.perEmailDay.limit,
      OTP_LIMITS.perEmailDay.windowSec,
    ),
    checkBucket(
      input.counter,
      'otp-ip-hour',
      input.ip,
      OTP_LIMITS.perIpHour.limit,
      OTP_LIMITS.perIpHour.windowSec,
    ),
  ]);
  if (results.includes('limited')) return 'limited';
  if (results.includes('unavailable')) return 'unavailable';
  return 'allowed';
}

// Guards Better Auth's own OTP endpoint. Same 200 shape whether or not the email exists is already
// Better Auth's behavior, so the only new signal here is a plain 429 that depends on volume, not on
// whether an account exists.
export function otpSendLimit(counter: RateLimitCounter): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method !== 'POST') return next();
    let email = '';
    try {
      const body: unknown = await c.req.raw.clone().json();
      if (body && typeof body === 'object' && 'email' in body && typeof body.email === 'string')
        email = body.email;
    } catch {
      // Not JSON / no body: let Better Auth reject it.
    }
    const result = await checkOtpSendLimits({ counter, email, ip: getClientIp(c) });
    if (result === 'limited') return tooMany(c, 'otp-send', OTP_LIMITS.perEmail10Min.windowSec);
    if (result === 'unavailable') return c.json({ error: 'rate_limit_unavailable' }, 503);
    return next();
  };
}
