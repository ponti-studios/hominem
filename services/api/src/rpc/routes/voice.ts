import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { recordAIUsageEvent } from '../../application/ai-usage.service';
import { VoiceCleanupInputSchema } from '../../schemas/voice.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { cleanupVoiceInput } from './voice-cleanup.service';

export const authenticatedVoiceRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .use('/cleanup', rateLimitMiddleware({ bucket: 'voice-cleanup', windowSec: 60, max: 30 }))
  .post('/cleanup', zValidator('json', VoiceCleanupInputSchema), async (c) => {
    const userId = c.get('userId')!;
    const requestId = c.get('requestId');
    const input = c.req.valid('json');

    const result = await cleanupVoiceInput(input);
    if (result.kind === 'provider-error') {
      return c.json({ message: result.message }, result.status);
    }

    await recordAIUsageEvent({
      userId,
      feature: 'voice_cleanup',
      operation: 'structured_output',
      usage: result.usage,
      requestId,
      metadata: {
        source: input.source,
        locale: input.locale ?? null,
      },
    });

    return c.json(result.output);
  });
