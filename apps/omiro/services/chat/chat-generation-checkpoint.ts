import {
  parseGenerationClientCheckpoint,
  toGenerationClientCheckpoint,
} from '@hominem/chat/client';
import type { GenerationClientState } from '@hominem/chat/client';
import { z } from 'zod';

import { storage } from '~/services/storage/mmkv';

import { toGenerationStage, type ChatGenerationState } from './chat-generation';

const retryInputSchema = z.strictObject({
  message: z.string(),
  fileIds: z.array(z.string()).optional(),
  responseModality: z.enum(['text', 'audio']).optional(),
});

function generationStorageKey(chatId: string) {
  return `chat-generation:${chatId}`;
}

function readStoredCheckpoint(chatId: string) {
  const raw = storage.getString(generationStorageKey(chatId));
  if (!raw) {
    return null;
  }

  const { userMessageId, targetMessageId, retryInput, ...rest } = z
    .looseObject({
      userMessageId: z.unknown().optional(),
      targetMessageId: z.unknown().optional(),
      retryInput: z.unknown().optional(),
    })
    .parse(JSON.parse(raw));
  const checkpoint = parseGenerationClientCheckpoint(rest);
  const parsedRetryInput = retryInputSchema.safeParse(retryInput);

  return {
    checkpoint,
    ...(typeof userMessageId === 'string' ? { userMessageId } : {}),
    ...(typeof targetMessageId === 'string' ? { targetMessageId } : {}),
    ...(parsedRetryInput.success ? { retryInput: parsedRetryInput.data } : {}),
  };
}

export function restoreGenerationCheckpoint(chatId: string): ChatGenerationState | null {
  try {
    const stored = readStoredCheckpoint(chatId);
    if (!stored) {
      return null;
    }

    const { checkpoint, userMessageId, targetMessageId, retryInput } = stored;
    if (checkpoint.phase === 'committed' || checkpoint.phase === 'cancelled') {
      storage.remove(generationStorageKey(chatId));
      return null;
    }

    return {
      id: checkpoint.generationId,
      chatId,
      stage: toGenerationStage(checkpoint.phase),
      lastDurableSequence: checkpoint.lastDurableSequence,
      ...(userMessageId ? { userMessageId } : {}),
      ...(targetMessageId ? { targetMessageId } : {}),
      ...(retryInput ? { retryInput } : {}),
    };
  } catch {
    storage.remove(generationStorageKey(chatId));
    return null;
  }
}

// The checkpoint only holds the generation id, phase and last durable sequence,
// so most events in a stream (every text delta that carries no new sequence)
// would rewrite identical bytes. Remember what was last written per chat and
// skip the read-parse-write round trip when nothing changed.
const lastWrittenCheckpoint = new Map<string, string>();

export function persistGenerationCheckpoint(
  chatId: string,
  state: Pick<
    ChatGenerationState,
    'id' | 'stage' | 'lastDurableSequence' | 'userMessageId' | 'targetMessageId' | 'retryInput'
  >,
) {
  const checkpoint = parseGenerationClientCheckpoint({
    generationId: state.id,
    phase: state.stage === 'stopping' ? 'cancel_requested' : state.stage,
    lastDurableSequence: state.lastDurableSequence,
  });
  lastWrittenCheckpoint.delete(chatId);
  storage.set(
    generationStorageKey(chatId),
    JSON.stringify({
      ...checkpoint,
      ...(state.userMessageId ? { userMessageId: state.userMessageId } : {}),
      ...(state.targetMessageId ? { targetMessageId: state.targetMessageId } : {}),
      ...(state.retryInput ? { retryInput: state.retryInput } : {}),
    }),
  );
}

export function clearGenerationCheckpoint(chatId: string) {
  lastWrittenCheckpoint.delete(chatId);
  storage.remove(generationStorageKey(chatId));
}

export function createGenerationCheckpointStore(chatId: string) {
  return {
    get: (_generationId: string) => {
      try {
        return readStoredCheckpoint(chatId)?.checkpoint ?? null;
      } catch {
        return null;
      }
    },
    set: (state: GenerationClientState) => {
      const checkpointJson = JSON.stringify(toGenerationClientCheckpoint(state));
      if (lastWrittenCheckpoint.get(chatId) === checkpointJson) {
        return;
      }
      let userMessageId: string | undefined;
      let targetMessageId: string | undefined;
      let retryInput: ChatGenerationState['retryInput'];
      try {
        const stored = readStoredCheckpoint(chatId);
        userMessageId = stored?.userMessageId;
        targetMessageId = stored?.targetMessageId;
        if (state.lastDurableSequence === 0) {
          retryInput = stored?.retryInput;
        }
      } catch {
        // Drop malformed local metadata rather than propagating it into a checkpoint.
      }

      storage.set(
        generationStorageKey(chatId),
        JSON.stringify({
          ...toGenerationClientCheckpoint(state),
          ...(userMessageId ? { userMessageId } : {}),
          ...(targetMessageId ? { targetMessageId } : {}),
          ...(retryInput ? { retryInput } : {}),
        }),
      );
      lastWrittenCheckpoint.set(chatId, checkpointJson);
    },
    remove: (_generationId: string) => clearGenerationCheckpoint(chatId),
  };
}
