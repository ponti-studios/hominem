import { randomUUID } from 'node:crypto';

import { getStructuredOutputUsage } from '@hominem/ai';
import { logger } from '@hominem/telemetry';
import { Hono } from 'hono';

import {
  assertAIUsageAllowed,
  recordAIUsageEvent,
  startAIUsageTimer,
} from '../../application/ai-usage.service';
import { extractTimeBlock } from '../../application/time-block-extraction.service';
import { ParseTimeBlockInputSchema } from '../../schemas/tasks.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { TIME_BLOCK_EXTRACTION_PROMPT } from '../prompts';
import { zValidator } from '../validator';

// Time-block parsing endpoint. Mounted under /tasks by tasks.ts.
export const timeBlockRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .use('/parse', rateLimitMiddleware({ bucket: 'ai-time-block-parse', windowSec: 60, max: 30 }))
  .post('/parse', zValidator('json', ParseTimeBlockInputSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const input = c.req.valid('json');

    await assertAIUsageAllowed(userId, c.get('auth')!.user.isAdmin);

    const eventId = randomUUID();
    const getDurationMs = startAIUsageTimer();
    try {
      const result = await extractTimeBlock(
        {
          transcript: input.transcript,
          referenceDate: input.referenceDate ?? new Date().toISOString(),
          timezone: input.timezone,
          conversationContext: input.conversationContext,
          calendarContext: input.calendarContext,
        },
        TIME_BLOCK_EXTRACTION_PROMPT,
      );
      await recordAIUsageEvent({
        eventId,
        userId,
        feature: 'time_block_extract',
        operation: 'structured_output',
        usage: result.usage,
        status: 'succeeded',
        durationMs: getDurationMs(),
      });
      return c.json({ block: result.block });
    } catch (error) {
      await recordAIUsageEvent({
        eventId,
        userId,
        feature: 'time_block_extract',
        operation: 'structured_output',
        usage: getStructuredOutputUsage(error),
        status: 'failed',
        error,
        durationMs: getDurationMs(),
      });
      logger.error('ai_time_block_extract_failed', {
        operation: 'ai.time_block_extract',
        failureType: 'ai.time_block_extract.failed',
        error_name: error instanceof Error ? error.name : 'unknown',
      });
      return c.json(
        { error: 'Time block extraction failed', failureType: 'ai.time_block_extract.failed' },
        500,
      );
    }
  });
