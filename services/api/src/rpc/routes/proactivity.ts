import { Hono } from 'hono';
import { z } from 'zod';

import {
  applyProactivityAction,
  undoProactivityAction,
} from '../../application/proactivity-actions.service';
import { loadOverview, runEvaluation } from '../../application/proactivity.service';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { zValidator } from '../validator';

const ApplyActionSchema = z.object({
  triggerId: z.string().min(1),
  goalId: z.uuid(),
  kind: z.enum(['task.create', 'goal.pause', 'finding.snooze']),
});

const ActionParamSchema = z.object({ id: z.uuid() });

export const proactivityRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/overview', async (c) => c.json(await loadOverview(c.get('auth')!.userId)))
  .use('/run', rateLimitMiddleware({ bucket: 'proactivity-run', windowSec: 60, max: 10 }))
  .post('/run', async (c) => c.json(await runEvaluation(c.get('auth')!.userId)))
  .use('/actions', rateLimitMiddleware({ bucket: 'proactivity-action', windowSec: 60, max: 20 }))
  .post('/actions', zValidator('json', ApplyActionSchema), async (c) =>
    c.json(await applyProactivityAction(c.get('auth')!.userId, c.req.valid('json'))),
  )
  .post('/actions/:id/undo', zValidator('param', ActionParamSchema), async (c) =>
    c.json(await undoProactivityAction(c.get('auth')!.userId, c.req.valid('param').id)),
  );
