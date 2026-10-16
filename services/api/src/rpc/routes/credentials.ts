import { logger } from '@hominem/telemetry';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { createOpenRouterKeys } from '../../application/openrouter-keys';
import {
  type CredentialDeps,
  mintCredential,
  revokeCredential,
} from '../../application/provider-credentials';
import { dbCredentialStore } from '../../application/provider-credentials.store';
import { env } from '../../env';
import { authMiddleware, type AppContext } from '../middleware/auth';

const deviceIdSchema = z.string().min(8).max(128);

function credentialDeps(): CredentialDeps | null {
  if (!env.OPENROUTER_MANAGEMENT_KEY) return null;
  return {
    store: dbCredentialStore,
    keys: createOpenRouterKeys(env.OPENROUTER_MANAGEMENT_KEY),
    capUsd: env.THAMES_MONTHLY_CAP_USD,
    log: (event, fields) => logger.error(event, fields),
  };
}

// Refusals carry a short machine code in `error` (the field the Hominem auth clients read as the
// message): not_listed, blocked, capped, rate_limited, unavailable.
// A person's own provider key for the Thames app (docs/prd/user-credentials.md in the Thames repo).
// The key is returned once and never stored here; only its hash is.
export const credentialsRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .post('/', zValidator('json', z.object({ deviceId: deviceIdSchema })), async (c) => {
    const auth = c.get('auth')!;
    const deps = credentialDeps();
    c.header('Cache-Control', 'no-store');
    if (!deps) return c.json({ error: 'unavailable' as const }, 503);

    const outcome = await mintCredential(deps, {
      userId: auth.userId,
      email: auth.user.email,
      deviceId: c.req.valid('json').deviceId,
    });
    switch (outcome.kind) {
      case 'minted':
        return c.json({ key: outcome.key, limitUsd: outcome.limitUsd }, 201);
      case 'capped':
        return c.json({ error: 'capped' as const }, 402);
      case 'rate_limited':
        return c.json({ error: 'rate_limited' as const }, 429);
      case 'not_listed':
      case 'blocked':
        return c.json({ error: outcome.kind }, 403);
    }
  })
  .delete('/:deviceId', zValidator('param', z.object({ deviceId: deviceIdSchema })), async (c) => {
    const deps = credentialDeps();
    if (!deps) return c.json({ error: 'unavailable' as const }, 503);
    const ended = await revokeCredential(deps, {
      userId: c.get('auth')!.userId,
      deviceId: c.req.valid('param').deviceId,
    });
    return ended ? c.body(null, 204) : c.json({ error: 'not_found' as const }, 404);
  });
