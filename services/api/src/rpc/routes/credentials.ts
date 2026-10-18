import { logger } from '@hominem/telemetry';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { creditFor } from '../../application/credit';
import { sendLowCreditEmail } from '../../application/credit-email';
import { creditDeps, personInCreditMode } from '../../application/credit.runtime';
import { devBase } from '../../application/credit.runtime';
import { createOpenRouterKeys, OpenRouterKeysError } from '../../application/openrouter-keys';
import {
  BudgetUnavailableError,
  budgetFor,
  type CredentialDeps,
  mintCredential,
  revokeCredential,
} from '../../application/provider-credentials';
import { dbCredentialStore } from '../../application/provider-credentials.store';
import { env } from '../../env';
import { authMiddleware, type AppContext } from '../middleware/auth';

const deviceIdSchema = z.string().min(8).max(128);

async function credentialDeps(user?: {
  id: string;
  email: string;
}): Promise<CredentialDeps | null> {
  if (!env.OPENROUTER_MANAGEMENT_KEY) return null;
  return {
    store: dbCredentialStore,
    keys: createOpenRouterKeys(
      env.OPENROUTER_MANAGEMENT_KEY,
      fetch,
      devBase(env.OPENROUTER_KEYS_BASE_URL),
    ),
    capUsd: env.THAMES_MONTHLY_CAP_USD,
    log: (event, fields) => logger.error(event, fields),
    // Only a person the credit flag lets in is given the balance rules.
    ...(user && (await personInCreditMode(user)) ? { credit: creditDeps() ?? undefined } : {}),
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
    const deps = await credentialDeps(auth.user);
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
  // How much of the monthly budget the person has used, for the app's Settings. A person who
  // cannot hold a key gets the same refusal as minting, so the app shows one calm reason.
  .get('/budget', async (c) => {
    const auth = c.get('auth')!;
    const deps = await credentialDeps(auth.user);
    c.header('Cache-Control', 'no-store');
    if (!deps) return c.json({ error: 'unavailable' as const }, 503);
    if (await deps.store.isBlocked(auth.userId)) return c.json({ error: 'blocked' as const }, 403);
    if (!(await deps.store.isAllowed(auth.user.email.trim().toLowerCase()))) {
      return c.json({ error: 'not_listed' as const }, 403);
    }
    try {
      // A person in credit mode gets their balance instead of the monthly numbers.
      if (deps.credit) {
        const credit = await creditFor(deps.credit, auth.userId, {
          send: ({ userId }) => sendLowCreditEmail(userId),
        });
        return c.json({ credit });
      }
      return c.json(await budgetFor(deps, auth.userId));
    } catch (error) {
      // Only the provider being slow or down is "unavailable"; anything else is a bug and goes to
      // the global error handler.
      if (error instanceof OpenRouterKeysError || error instanceof BudgetUnavailableError) {
        logger.error('credential_budget_failed', { error: error.message });
        return c.json({ error: 'unavailable' as const }, 503);
      }
      throw error;
    }
  })
  .delete('/:deviceId', zValidator('param', z.object({ deviceId: deviceIdSchema })), async (c) => {
    const deps = await credentialDeps();
    if (!deps) return c.json({ error: 'unavailable' as const }, 503);
    const ended = await revokeCredential(deps, {
      userId: c.get('auth')!.userId,
      deviceId: c.req.valid('param').deviceId,
    });
    return ended ? c.body(null, 204) : c.json({ error: 'not_found' as const }, 404);
  });
