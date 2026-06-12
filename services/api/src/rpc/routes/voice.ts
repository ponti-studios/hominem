import { VoiceCleanupInputSchema } from '@hominem/rpc/schemas/voice.schema';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { cleanupVoiceInput } from './voice-cleanup.service';

export const authenticatedVoiceRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .use('/cleanup', rateLimitMiddleware({ bucket: 'voice-cleanup', windowSec: 60, max: 30 }))
  .post('/cleanup', zValidator('json', VoiceCleanupInputSchema), async (c) => {
    const input = c.req.valid('json');

    const result = await cleanupVoiceInput(input);
    if (result.kind === 'provider-error') {
      return c.json({ message: result.message }, result.status);
    }

    return c.json(result.output);
  });
