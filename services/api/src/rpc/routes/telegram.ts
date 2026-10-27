import { Hono } from 'hono';

import { env } from '../../env';
import { createTelegramLinkService } from '../../messaging/link.service';
import { authMiddleware, type AppContext } from '../middleware/auth';

const telegram = createTelegramLinkService({
  ownerUserId: env.TELEGRAM_OWNER_USER_ID,
  botUsername: env.TELEGRAM_BOT_USERNAME,
  botToken: env.TELEGRAM_BOT_TOKEN,
});

export const telegramRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/connection', async (c) => {
    const userId = c.get('auth')!.userId;
    if (env.TELEGRAM_OWNER_USER_ID && !telegram.isOwner(userId)) {
      return c.json({ available: false as const, connected: false as const });
    }
    if (!env.TELEGRAM_OWNER_USER_ID) {
      return c.json({
        available: true as const,
        connected: false as const,
        configured: false as const,
        accountId: userId,
      });
    }
    return c.json({
      available: true as const,
      connected: (await telegram.status(userId))?.connected ?? false,
      configured: Boolean(
        env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_USERNAME && env.TELEGRAM_WEBHOOK_SECRET,
      ),
      accountId: userId,
    });
  })
  .post('/connection/link', async (c) => {
    const userId = c.get('auth')!.userId;
    if (!telegram.isOwner(userId)) return c.json({ error: 'forbidden' }, 403);
    if (!env.TELEGRAM_WEBHOOK_SECRET) return c.json({ error: 'telegram_not_configured' }, 503);
    const result = await telegram.createLink(userId);
    if (!result) return c.json({ error: 'telegram_not_configured' }, 503);
    if (result.connected) return c.json({ connected: true as const });
    return c.json({ connected: false as const, url: result.url });
  })
  .delete('/connection', async (c) => {
    const userId = c.get('auth')!.userId;
    if (!(await telegram.unlink(userId))) return c.json({ error: 'forbidden' }, 403);
    return c.json({ connected: false as const });
  });
