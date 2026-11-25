import { Hono } from 'hono';

import { financeSync } from '../../application/finance.sync.service';
import { financeSyncInputSchema } from '../../schemas/finance.sync.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { zValidator } from '../validator';

export const syncRoutes = new Hono<AppContext>().post(
  '/',
  authMiddleware,
  zValidator('json', financeSyncInputSchema),
  async (c) => c.json(await financeSync(c.get('auth')!.userId, c.req.valid('json'))),
);
