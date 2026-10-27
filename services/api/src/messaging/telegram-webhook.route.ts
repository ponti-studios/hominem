import { createHash, timingSafeEqual } from 'node:crypto';

import { db } from '@hominem/db/core';
import { MessagingRepository } from '@hominem/db/messaging';
import { messagingInboundQueue } from '@hominem/queues';
import { logger } from '@hominem/telemetry';
import { Hono } from 'hono';
import { z } from 'zod';

import type { ApiEnv } from '../env.schema';
import { checkBucket, hashKeyPart, type RateLimitCounter } from '../middleware/rate-limit';
import type { AppEnv } from '../server';
import { telegramUpdateSchema } from './telegram';

function equalsSecret(actual: string | undefined, expected: string) {
  if (!actual || !expected) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function isLinkStart(text: string | undefined) {
  return Boolean(text && /^\/start(?:\s|$)/.test(text));
}

function privateSender(update: z.infer<typeof telegramUpdateSchema>) {
  const message = update.message;
  if (
    message?.chat.type === 'private' &&
    message.from &&
    !message.from.is_bot &&
    String(message.from.id) === String(message.chat.id)
  ) {
    return { userId: String(message.from.id), chatId: String(message.chat.id), text: message.text };
  }
  const callback = update.callback_query;
  if (
    callback?.message?.chat.type === 'private' &&
    !callback.from.is_bot &&
    String(callback.from.id) === String(callback.message.chat.id)
  ) {
    return {
      userId: String(callback.from.id),
      chatId: String(callback.message.chat.id),
      text: undefined,
    };
  }
  return null;
}

export function createTelegramWebhookRoutes(input: {
  env: ApiEnv;
  rateLimitCounter?: RateLimitCounter;
}) {
  return new Hono<AppEnv>().post('/', async (c) => {
    if (!input.env.TELEGRAM_BOT_TOKEN || !input.env.TELEGRAM_WEBHOOK_SECRET) {
      return c.json({ error: 'telegram_not_configured' }, 503);
    }
    if (
      !equalsSecret(
        c.req.header('X-Telegram-Bot-Api-Secret-Token'),
        input.env.TELEGRAM_WEBHOOK_SECRET,
      )
    ) {
      return c.json({ error: 'unauthorized' }, 401);
    }

    const parsed = telegramUpdateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ ok: true });
    const sender = privateSender(parsed.data);
    if (!sender) return c.json({ ok: true });

    if (input.rateLimitCounter) {
      const rate = await checkBucket(
        input.rateLimitCounter,
        'telegram-owner',
        hashKeyPart(sender.userId),
        20,
        60,
      );
      if (rate === 'limited') return c.json({ error: 'rate_limited' }, 429);
      if (rate === 'unavailable') return c.json({ error: 'rate_limit_unavailable' }, 503);
    }

    // Linking commands carry a single-use 256-bit code. All other updates are
    // accepted only from the already-linked Telegram identity and private chat.
    if (!isLinkStart(sender.text)) {
      const identity = await MessagingRepository.getActiveForTelegramUser(db, sender.userId);
      if (!identity || identity.externalChatId !== sender.chatId) return c.json({ ok: true });
    }

    const senderHash = createHash('sha256').update(sender.userId).digest('hex').slice(0, 32);
    const dedupeKey = `telegram-${parsed.data.update_id}`;
    try {
      await messagingInboundQueue.add(
        'telegram-update',
        { updateId: parsed.data.update_id, update: parsed.data },
        {
          jobId: dedupeKey,
          attempts: 8,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: { age: 86_400, count: 1_000 },
          removeOnFail: { age: 604_800, count: 1_000 },
        },
      );
      logger.info('telegram_update_queued', { updateId: parsed.data.update_id, senderHash });
      return c.json({ ok: true });
    } catch (error) {
      logger.error('telegram_update_enqueue_failed', {
        updateId: parsed.data.update_id,
        senderHash,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      return c.json({ error: 'queue_unavailable' }, 503);
    }
  });
}
