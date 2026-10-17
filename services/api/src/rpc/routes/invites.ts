import { logger } from '@hominem/telemetry';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import QRCode from 'qrcode';
import { z } from 'zod';

import { dbCredentialStore } from '../../application/provider-credentials.store';
import { inviteToThames, type InviteDeps } from '../../application/thames-invite';
import { sendEmail } from '../../auth/better-auth';
import { env } from '../../env';
import { getClientIp } from '../../middleware/client-ip';
import { getRedis } from '../../redis';
import type { AppContext } from '../middleware/auth';

async function withinLimit(key: string, max: number, windowSec: number) {
  try {
    const redis = await getRedis();
    const redisKey = `ratelimit:invite:thames:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSec);
    return count <= max;
  } catch {
    // Redis down: fail closed, because this route sends email to strangers.
    return false;
  }
}

function inviteDeps(): InviteDeps {
  return {
    link: env.THAMES_TESTFLIGHT_URL,
    isAllowed: dbCredentialStore.isAllowed,
    withinLimit,
    qrPng: (link) => QRCode.toBuffer(link, { type: 'png', width: 440, margin: 2 }),
    send: (message) => sendEmail(env, message),
  };
}

// Anonymous on purpose: the person has no account yet. It answers 202 for every outcome so the
// page cannot be used to learn which domains are on the list.
export const invitesRoutes = new Hono<AppContext>().post(
  '/thames',
  zValidator('json', z.object({ email: z.string().trim().max(254).pipe(z.email()) })),
  async (c) => {
    c.header('Cache-Control', 'no-store');
    const network = getClientIp(c);
    try {
      const outcome = await inviteToThames(inviteDeps(), {
        email: c.req.valid('json').email,
        network,
      });
      logger.info('thames_invite', { outcome });
    } catch (error) {
      logger.error('thames_invite_failed', { error });
    }
    return c.json({ ok: true as const }, 202);
  },
);
