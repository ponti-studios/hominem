import { cleanupVoiceTranscript, OpenRouterRequestError } from '@hominem/ai';
import {
  VoiceCleanupInputSchema,
  VoiceCleanupOutputSchema,
} from '@hominem/rpc/schemas/voice.schema';
import { logger } from '@hominem/telemetry';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';

const VOICE_CLEANUP_MIN_LENGTH = 8;
const VOICE_CLEANUP_MIN_WORDS = 2;
const VOICE_CLEANUP_MIN_LENGTH_RATIO = 0.45;
const VOICE_CLEANUP_MAX_LENGTH_RATIO = 2.5;

function countTranscriptWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function shouldBypassVoiceCleanup(text: string) {
  const trimmed = text.trim();
  return (
    trimmed.length < VOICE_CLEANUP_MIN_LENGTH ||
    countTranscriptWords(trimmed) < VOICE_CLEANUP_MIN_WORDS
  );
}

function isSafeVoiceCleanup(rawText: string, cleanedText: string) {
  const rawTrimmed = rawText.trim();
  const cleanedTrimmed = cleanedText.trim();

  if (!cleanedTrimmed) return false;

  const rawLength = rawTrimmed.length;
  const cleanedLength = cleanedTrimmed.length;

  if (rawLength === 0) return false;

  const lengthRatio = cleanedLength / rawLength;
  if (
    lengthRatio < VOICE_CLEANUP_MIN_LENGTH_RATIO ||
    lengthRatio > VOICE_CLEANUP_MAX_LENGTH_RATIO
  ) {
    return false;
  }

  const rawWords = countTranscriptWords(rawTrimmed);
  const cleanedWords = countTranscriptWords(cleanedTrimmed);

  if (rawWords >= 6 && cleanedWords < Math.ceil(rawWords / 2)) {
    return false;
  }

  return true;
}

function buildFallbackOutput(rawText: string) {
  return VoiceCleanupOutputSchema.parse({
    rawText,
    cleanedText: rawText,
    changed: false,
    mode: 'constrained',
  });
}

function getVoiceCleanupErrorStatus(error: unknown) {
  if (error instanceof OpenRouterRequestError) {
    return error.status;
  }

  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === 'number' ? statusCode : undefined;
  }

  return undefined;
}

export const authenticatedVoiceRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .use('/cleanup', rateLimitMiddleware({ bucket: 'voice-cleanup', windowSec: 60, max: 30 }))
  .post('/cleanup', zValidator('json', VoiceCleanupInputSchema), async (c) => {
    const input = c.req.valid('json');
    const rawText = input.rawText.trim();

    if (shouldBypassVoiceCleanup(rawText)) {
      return c.json(buildFallbackOutput(rawText));
    }

    try {
      const { cleanedText } = await cleanupVoiceTranscript({
        rawText,
        ...(input.locale ? { locale: input.locale } : {}),
      });
      const normalizedCleanedText = cleanedText.trim();
      const safeCleanedText = isSafeVoiceCleanup(rawText, normalizedCleanedText)
        ? normalizedCleanedText
        : rawText;

      return c.json(
        VoiceCleanupOutputSchema.parse({
          rawText,
          cleanedText: safeCleanedText,
          changed: safeCleanedText !== rawText,
          mode: 'constrained',
        }),
      );
    } catch (error) {
      logger.error('[voice-cleanup] cleanup failed', {
        source: input.source,
        locale: input.locale,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      const status = getVoiceCleanupErrorStatus(error);
      if (status === 401 || status === 429) {
        return c.json(
          { message: error instanceof Error ? error.message : 'Voice cleanup failed' },
          status,
        );
      }

      return c.json(buildFallbackOutput(rawText));
    }
  });
