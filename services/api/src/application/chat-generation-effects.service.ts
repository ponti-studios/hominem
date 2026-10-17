import {
  ChatGenerationEffectsRepository,
  type ChatGenerationEffectRecord,
} from '@hominem/db/chats';
import { db, runInTransaction } from '@hominem/db/core';
import { embeddingQueue } from '@hominem/queues';
import { logger } from '@hominem/telemetry';

import { persistSpeechRun, type SynthesizedChatAudio } from '../chat/chat-speech.service';

const MAX_BATCH_SIZE = 100;
type EmbeddingQueue = {
  add: (...args: Parameters<typeof embeddingQueue.add>) => Promise<unknown>;
};

function payloadObject(effect: ChatGenerationEffectRecord): Record<string, unknown> {
  const value: unknown = effect.payload;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>((payload, [key, item]) => {
      payload[key] = item;
      return payload;
    }, {});
  }
  throw new Error('InvalidChatGenerationEffectPayload');
}

function payloadString(payload: Record<string, unknown>, field: string): string {
  const value = payload[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('InvalidChatGenerationEffectPayload');
  }
  return value;
}

async function executeEffect(
  effect: ChatGenerationEffectRecord,
  targetEmbeddingQueue: EmbeddingQueue = embeddingQueue,
): Promise<void> {
  const payload = payloadObject(effect);
  if (effect.effectType === 'chat_embedding') {
    const chatId = payloadString(payload, 'chatId');
    await targetEmbeddingQueue.add(
      'generate-embedding',
      {
        jobId: `chat-${chatId}`,
        userId: effect.ownerUserId,
        entityType: 'chat',
        entityId: chatId,
      },
      { jobId: `chat-${chatId}`, removeOnComplete: true, removeOnFail: false },
    );
    return;
  }

  const messageId = payloadString(payload, 'messageId');
  const eventId = payloadString(payload, 'eventId');
  const speechRunId = payloadString(payload, 'speechRunId');
  const characterCount = payload.characterCount;
  const status = payload.status;
  const usageAvailable = payload.usageAvailable;
  const generationId = payload.generationId;
  if (
    typeof characterCount !== 'number' ||
    !Number.isSafeInteger(characterCount) ||
    characterCount < 0 ||
    (status !== 'succeeded' && status !== 'failed') ||
    typeof usageAvailable !== 'boolean' ||
    (generationId !== null && typeof generationId !== 'string')
  ) {
    throw new Error('InvalidChatGenerationEffectPayload');
  }
  const audio: SynthesizedChatAudio = {
    file: null,
    eventId,
    speechRunId,
    generationId,
    usageAvailable,
    status,
  };
  await persistSpeechRun(messageId, effect.ownerUserId, characterCount, audio, speechRunId);
}

export async function processChatGenerationEffect(
  id: string,
  options: { embeddingQueue?: EmbeddingQueue } = {},
): Promise<boolean> {
  let claimed: ChatGenerationEffectRecord | null;
  try {
    claimed = await runInTransaction((trx) => ChatGenerationEffectsRepository.claim(trx, id));
  } catch (error) {
    logger.warn('chat_generation_effect_claim_failed', {
      effectId: id,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return false;
  }
  if (!claimed) return false;

  try {
    await executeEffect(claimed, options.embeddingQueue);
    await ChatGenerationEffectsRepository.complete(db, claimed.id);
    logger.info('chat_generation_effect_completed', {
      effectId: claimed.id,
      effectType: claimed.effectType,
    });
    return true;
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    try {
      await ChatGenerationEffectsRepository.retry(db, claimed.id, errorName);
    } catch (retryError) {
      logger.error('chat_generation_effect_retry_state_failed', {
        effectId: claimed.id,
        effectType: claimed.effectType,
        errorName: retryError instanceof Error ? retryError.name : 'UnknownError',
      });
    }
    logger.warn('chat_generation_effect_failed', {
      effectId: claimed.id,
      effectType: claimed.effectType,
      errorName,
    });
    return false;
  }
}

export async function processReadyChatGenerationEffects(): Promise<{
  found: number;
  completed: number;
}> {
  const ids = await ChatGenerationEffectsRepository.listReady(db, MAX_BATCH_SIZE);
  const outcomes = await Promise.all(ids.map((id) => processChatGenerationEffect(id)));
  return { found: ids.length, completed: outcomes.filter(Boolean).length };
}
