import { enhanceText } from '@hominem/ai';
import { logger } from '@hominem/telemetry';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { EnhanceTextInputSchema } from '../../schemas/enhance.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { loadPrompt } from '../utils/load-prompt';

const ENHANCE_SYSTEM_PROMPT = loadPrompt('text-enhance');

export const enhanceRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .use('/enhance', rateLimitMiddleware({ bucket: 'ai-enhance', windowSec: 60, max: 30 }))
  .post('/enhance', zValidator('json', EnhanceTextInputSchema), async (c) => {
    const { text, instruction } = c.req.valid('json');

    try {
      const enhanced = await enhanceText({ text, instruction }, ENHANCE_SYSTEM_PROMPT);
      return c.json({ text: enhanced });
    } catch (error) {
      logger.error('[ai/enhance] OpenRouter error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return c.json({ error: 'Enhancement failed' }, 500);
    }
  });
