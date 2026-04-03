import { createHash, randomBytes } from 'node:crypto';

import { db } from '@hominem/db';
import { getSetCookieHeaders } from '@hominem/utils/headers';
import { logger } from '@hominem/utils/logger';
import { zValidator } from '@hono/zod-validator';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';

import { betterAuthServer } from '../auth/better-auth';
import { getLatestTestOtp, isTestOtpStoreEnabled } from '../auth/test-otp-store';

import { env } from '../env';
import type { AppEnv } from '../server';

export const authRoutes = new Hono<AppEnv>();

const deviceCodeSchema = z.object({
  client_id: z.string().min(1),
  scope: z.string().optional(),
});

const deviceTokenSchema = z.object({
  grant_type: z.literal('urn:ietf:params:oauth:grant-type:device_code'),
  device_code: z.string().min(1),
  client_id: z.string().min(1),
});
const deviceVerifySchema = z.object({
  user_code: z.string().min(1),
});
const deviceApproveSchema = z.object({
  userCode: z.string().min(1),
});

const mobileE2eLoginSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(128).optional(),
  amr: z.array(z.string()).optional(),
});
const testOtpQuerySchema = z.object({
  email: z.string().email(),
  type: z.string().min(1).optional(),
});

const AUTH_REFRESH_LIMIT_WINDOW_SECONDS = 60;
const AUTH_REFRESH_LIMIT_MAX = 25;
const AUTH_DEVICE_CODE_LIMIT_WINDOW_SECONDS = 10 * 60;
const AUTH_DEVICE_CODE_LIMIT_MAX = 10;
const AUTH_DEVICE_TOKEN_LIMIT_WINDOW_SECONDS = 10 * 60;
const AUTH_DEVICE_TOKEN_LIMIT_MAX = 120;
const AUTH_E2E_LOGIN_LIMIT_WINDOW_SECONDS = 60;
const AUTH_E2E_LOGIN_LIMIT_MAX = 20;

interface AuthRateLimitInput {
  bucket: string;
  identifier: string;
  windowSec: number;
  max: number;
}

function isE2eAuthEnabled() {
  return env.AUTH_E2E_ENABLED && env.NODE_ENV !== 'production';
}

function isTestOtpRetrievalEnabled() {
  return isTestOtpStoreEnabled();
}

async function getRedis() {
  const { redis } = await import('@hominem/services/redis');
  return redis;
}

function getClientIp(c: Context<AppEnv>) {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded && forwarded.length > 0) {
    const [first] = forwarded.split(',');
    return first?.trim() ?? 'unknown';
  }
  return c.req.header('x-real-ip') ?? 'unknown';
}

function hashRateLimitIdentifier(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

async function enforceAuthRateLimit(c: Context<AppEnv>, input: AuthRateLimitInput) {
  try {
    const redis = await getRedis();
    const key = `ratelimit:auth:${input.bucket}:${hashRateLimitIdentifier(input.identifier)}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, input.windowSec);
    }

    c.header('X-RateLimit-Limit', String(input.max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, input.max - count)));

    if (count > input.max) {
      return c.json(
        {
          error: 'rate_limit_exceeded',
          message: 'Auth rate limit exceeded. Retry later.',
        },
        429,
      );
    }
  } catch {
    // Fail open on cache failures to preserve auth availability.
  }

  return null;
}

function copyHeadersWithSetCookie(headers: Headers) {
  const copied = new Headers(headers);
  const setCookies = getSetCookieHeaders(headers);

  if (setCookies.length > 0) {
    copied.delete('set-cookie');
    for (const setCookie of setCookies) {
      copied.append('set-cookie', setCookie);
    }
  }

  return copied;
}

function buildBetterAuthUrl(input: {
  request: Request;
  path?: string | undefined;
  preserveQuery?: boolean | undefined;
}) {
  const requestUrl = new URL(input.request.url);
  const targetPath = input.path ? `/api/auth${input.path}` : requestUrl.pathname;
  const targetUrl = new URL(targetPath, env.API_URL);

  if (input.preserveQuery) {
    targetUrl.search = requestUrl.search;
  }

  return targetUrl;
}

function ensureTrustedOrigin(headers: Headers) {
  const existingOrigin = headers.get('origin');
  if (existingOrigin && existingOrigin.length > 0) {
    return;
  }

  headers.set('origin', env.API_URL);
}

async function callBetterAuthPluginEndpoint(input: {
  request: Request;
  path?: string | undefined;
  method: string;
  preserveQuery?: boolean | undefined;
  body?: BodyInit | null | undefined;
}) {
  const url = buildBetterAuthUrl({
    request: input.request,
    ...(input.path ? { path: input.path } : {}),
    ...(input.preserveQuery ? { preserveQuery: true } : {}),
  });
  logger.debug('[auth:plugin] forwarding Better Auth endpoint', {
    method: input.method,
    targetUrl: url.toString(),
  });
  const headers = new Headers(input.request.headers);
  ensureTrustedOrigin(headers);
  if (input.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return betterAuthServer.handler(
    new Request(url.toString(), {
      method: input.method,
      headers,
      ...(input.body ? { body: input.body } : {}),
    }),
  );
}

async function forwardBetterAuthPluginResponse(input: {
  request: Request;
  path?: string | undefined;
  method: string;
  preserveQuery?: boolean | undefined;
  body?: BodyInit | null | undefined;
}) {
  const response = await callBetterAuthPluginEndpoint(input);
  const responseBody = await response.arrayBuffer();
  const headers = copyHeadersWithSetCookie(response.headers);

  return new Response(responseBody, {
    status: response.status,
    headers,
  });
}

authRoutes.post('/mobile/e2e/login', zValidator('json', mobileE2eLoginSchema), async (c) => {
  const clientIp = getClientIp(c);
  const userAgent = c.req.header('user-agent') ?? 'unknown';
  const auditContext = {
    actor: 'mobile-e2e-client',
    clientIp,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    userAgent,
  };

  if (!isE2eAuthEnabled()) {
    logger.warn('[auth:e2e:mobile] denied because E2E auth is disabled', {
      ...auditContext,
      denialReason: 'e2e_auth_disabled',
    });
    return c.json({ error: 'not_found' }, 404);
  }

  const providedSecret = c.req.header('x-e2e-auth-secret');
  if (!providedSecret || !env.AUTH_E2E_SECRET || providedSecret !== env.AUTH_E2E_SECRET) {
    logger.warn('[auth:e2e:mobile] denied because secret header is invalid', {
      ...auditContext,
      denialReason: 'invalid_secret',
      hasProvidedSecret: Boolean(providedSecret),
    });
    return c.json({ error: 'forbidden' }, 403);
  }

  const e2eLoginRateLimit = await enforceAuthRateLimit(c, {
    bucket: 'mobile-e2e-login',
    identifier: getClientIp(c),
    windowSec: AUTH_E2E_LOGIN_LIMIT_WINDOW_SECONDS,
    max: AUTH_E2E_LOGIN_LIMIT_MAX,
  });
  if (e2eLoginRateLimit) {
    return e2eLoginRateLimit;
  }

  const payload = c.req.valid('json');
  const email = payload.email ?? 'mobile-e2e@hominem.test';
  const name = payload.name ?? 'Mobile E2E User';
  const amr = payload.amr && payload.amr.length > 0 ? payload.amr : ['e2e', 'mobile'];
  const emailHash = createHash('sha256').update(email).digest('hex').slice(0, 16);

  const existingUser = await db
    .selectFrom('user')
    .selectAll()
    .where('email', '=', email)
    .limit(1)
    .executeTakeFirst();

  const user =
    existingUser ??
    (await db
      .insertInto('user')
      .values({
        id: randomBytes(16).toString('hex'),
        email,
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returningAll()
      .executeTakeFirst());

  if (!user) {
    logger.error('[auth:e2e:mobile] failed to create or fetch user', {
      clientIp,
      emailHash,
    });
    return c.json({ error: 'e2e_user_create_failed' }, 500);
  }

  logger.info('[auth:e2e:mobile] user fetched', {
    ...auditContext,
    emailHash,
    userId: user.id,
  });

  const response = {
    access_token: '',
    refresh_token: '',
    token_type: 'Bearer',
    expires_in: 0,
    session_id: '',
    refresh_family_id: '',
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
    },
  };

  return c.json(response);
});

authRoutes.get('/test/otp/latest', zValidator('query', testOtpQuerySchema), async (c) => {
  if (!isTestOtpRetrievalEnabled()) {
    return c.json({ error: 'not_found' }, 404);
  }

  const providedSecret = c.req.header('x-e2e-auth-secret');
  if (!providedSecret || providedSecret !== env.AUTH_E2E_SECRET) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const query = c.req.valid('query');
  const record = getLatestTestOtp({
    email: query.email,
    ...(query.type ? { type: query.type } : {}),
  });

  if (!record) {
    return c.json({ error: 'otp_not_found' }, 404);
  }

  return c.json({
    email: record.email,
    otp: record.otp,
    type: record.type,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  });
});

authRoutes.post('/device/code', zValidator('json', deviceCodeSchema), async (c) => {
  const payload = c.req.valid('json');
  const deviceCodeRateLimit = await enforceAuthRateLimit(c, {
    bucket: 'device-code',
    identifier: `${getClientIp(c)}:${payload.client_id}`,
    windowSec: AUTH_DEVICE_CODE_LIMIT_WINDOW_SECONDS,
    max: AUTH_DEVICE_CODE_LIMIT_MAX,
  });
  if (deviceCodeRateLimit) {
    return deviceCodeRateLimit;
  }

  try {
    const response = await callBetterAuthPluginEndpoint({
      request: c.req.raw,
      path: '/device/code',
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    return c.json(body as Record<string, unknown>, response.status as 200 | 400 | 401);
  } catch {
    return c.json({ error: 'device_code_failed' }, 400);
  }
});

authRoutes.get('/device', zValidator('query', deviceVerifySchema), async (c) => {
  try {
    return await forwardBetterAuthPluginResponse({
      request: c.req.raw,
      path: '/device',
      method: 'GET',
      preserveQuery: true,
    });
  } catch {
    return c.json({ error: 'device_verify_failed' }, 400);
  }
});

authRoutes.post('/device/approve', zValidator('json', deviceApproveSchema), async (c) => {
  try {
    const payload = c.req.valid('json');
    return await forwardBetterAuthPluginResponse({
      request: c.req.raw,
      path: '/device/approve',
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    return c.json({ error: 'device_approve_failed' }, 400);
  }
});

authRoutes.post('/device/token', zValidator('json', deviceTokenSchema), async (c) => {
  const payload = c.req.valid('json');
  const deviceTokenRateLimit = await enforceAuthRateLimit(c, {
    bucket: 'device-token',
    identifier: `${getClientIp(c)}:${payload.client_id}:${payload.device_code.slice(0, 16)}`,
    windowSec: AUTH_DEVICE_TOKEN_LIMIT_WINDOW_SECONDS,
    max: AUTH_DEVICE_TOKEN_LIMIT_MAX,
  });
  if (deviceTokenRateLimit) {
    return deviceTokenRateLimit;
  }

  try {
    return await forwardBetterAuthPluginResponse({
      request: c.req.raw,
      path: '/device/token',
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    return c.json({ error: 'device_token_failed' }, 400);
  }
});

authRoutes.on(['GET', 'POST'], '/*', async (c) => {
  const method = c.req.method;
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : await c.req.raw.clone().text();

  return await forwardBetterAuthPluginResponse({
    request: c.req.raw,
    method,
    preserveQuery: true,
    ...(body ? { body } : {}),
  });
});
