import { Hono } from 'hono';

import { loadOverview, runEvaluation } from '../../application/proactivity.service';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';

export const proactivityRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/overview', async (c) => c.json(await loadOverview(c.get('auth')!.userId)))
  .use('/run', rateLimitMiddleware({ bucket: 'proactivity-run', windowSec: 60, max: 10 }))
  .post('/run', async (c) => c.json(await runEvaluation(c.get('auth')!.userId)));
