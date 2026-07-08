import { enhanceText } from '@hominem/ai';
import { AIUsageEventRepository, db } from '@hominem/db';
import { logger } from '@hominem/telemetry';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { recordAIUsageEvent } from '../../application/ai-usage.service';
import { AIUsageQuerySchema } from '../../schemas/ai.schema';
import { EnhanceTextInputSchema } from '../../schemas/enhance.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { TEXT_ENHANCE_PROMPT } from '../prompts';

export const enhanceRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/usage', zValidator('query', AIUsageQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const query = c.req.valid('query');
    const input = {
      userId,
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
    };

    const [summary, byFeature, byModel] = await Promise.all([
      AIUsageEventRepository.getSummary(db, input),
      AIUsageEventRepository.getFeatureBreakdown(db, input),
      AIUsageEventRepository.getModelBreakdown(db, input),
    ]);

    return c.json({
      range: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
      summary,
      byFeature,
      byModel,
    });
  })
  .use('/enhance', rateLimitMiddleware({ bucket: 'ai-enhance', windowSec: 60, max: 30 }))
  .post('/enhance', zValidator('json', EnhanceTextInputSchema), async (c) => {
    const userId = c.get('userId')!;
    const requestId = c.get('requestId');
    const { text, instruction } = c.req.valid('json');

    try {
      const enhanced = await enhanceText({ text, instruction }, TEXT_ENHANCE_PROMPT);
      await recordAIUsageEvent({
        userId,
        feature: 'text_enhance',
        operation: 'chat_completion',
        usage: enhanced.usage,
        requestId,
        metadata: {
          instructionProvided: Boolean(instruction),
        },
      });
      return c.json({ text: enhanced.text });
    } catch (error) {
      logger.error('[ai/enhance] OpenRouter error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return c.json({ error: 'Enhancement failed' }, 500);
    }
  });
