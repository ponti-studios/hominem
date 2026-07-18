import { Hono } from 'hono';

import { getMonthlyUsageStatus } from '../../application/ai-usage.service';
import { authMiddleware, type AppContext } from '../middleware/auth';

export const usageRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/monthly', async (c) => {
    const userId = c.get('auth')!.userId;
    const status = await getMonthlyUsageStatus(userId);
    return c.json(status);
  });
