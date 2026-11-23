import { Hono } from 'hono';

import { getStudioService } from '../../application/proactivity.service';
import { InjectInputSchema, RunEventInputSchema } from '../../schemas/proactivity.schema';
import { NotFoundError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { zValidator } from '../validator';

export const proactivityRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/studio', (c) => c.json(getStudioService().view()))
  .use('/run', rateLimitMiddleware({ bucket: 'proactivity-run', windowSec: 60, max: 10 }))
  .post('/run', zValidator('json', RunEventInputSchema), async (c) => {
    const input = c.req.valid('json');
    const studio = getStudioService();
    if (!studio.view().events.some((event) => event.id === input.eventId)) {
      throw new NotFoundError('ProactivityEvent', { eventId: input.eventId });
    }
    await studio.runEvent(input.eventId, input.force ?? false);
    return c.json(studio.view());
  })
  .use('/inject', rateLimitMiddleware({ bucket: 'proactivity-inject', windowSec: 60, max: 10 }))
  .post('/inject', zValidator('json', InjectInputSchema), async (c) => {
    const input = c.req.valid('json');
    const studio = getStudioService();
    if (!studio.view().presets.some((preset) => preset.id === input.presetId)) {
      throw new NotFoundError('ProactivityPreset', { presetId: input.presetId });
    }
    return c.json(await studio.runInjection(input.presetId));
  })
  .post('/reset', (c) => c.json(getStudioService().reset()));
