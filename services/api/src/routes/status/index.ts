import { db } from '@hominem/db/core';
import { logger } from '@hominem/telemetry';
import { Hono } from 'hono';

import { env } from '../../env';
import { UnavailableError } from '../../errors';
import { resolveAiProvider, resolveEmailProvider } from '../../provider-mode';
import type { AppEnv } from '../../server';

export const statusRoutes = new Hono<AppEnv>();

statusRoutes.get('/', async (c) => {
  try {
    await db.selectFrom('user').select('id').limit(1).executeTakeFirst();

    return c.json({
      status: 'ok',
      serverTime: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      // Lets local tooling (e.g. the Maestro suite) confirm it's talking to
      // a scripted, deterministic API instead of one making real LLM/email
      // calls. Not sensitive — provider names, not credentials.
      ...(env.NODE_ENV !== 'production'
        ? { providers: { ai: resolveAiProvider(env), email: resolveEmailProvider(env) } }
        : {}),
    });
  } catch (err) {
    logger.error('Health check failed', { error: err });
    throw new UnavailableError('Health check failed', {
      status: 'error',
      serverTime: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'disconnected',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});
