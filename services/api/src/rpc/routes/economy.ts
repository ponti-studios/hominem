import { Hono } from 'hono';

import type { AppContext } from '../middleware/auth';
import { financeRoutes } from './finance';

export const economyRoutes = new Hono<AppContext>()
  .route('/finance', financeRoutes);
