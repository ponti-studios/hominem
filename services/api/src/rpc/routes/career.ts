import { db, PortfolioRepository } from '@hominem/db';
import { Hono } from 'hono';

import { authMiddleware, type AppContext } from '../middleware/auth';

export const careerRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/portfolio', async (c) => {
    const userId = c.get('auth')!.userId;
    const portfolio = await PortfolioRepository.getPortfolioByUserId(db, userId);
    return c.json({ portfolio });
  });
