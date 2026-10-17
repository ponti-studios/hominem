import type { GenerationEvent } from '@hominem/chat';
import { GenerationProjectionError } from '@hominem/chat/projection';
import { ChatGenerationRepository, ChatRepository } from '@hominem/db/chats';
import { db } from '@hominem/db/core';
import { runInTransaction } from '@hominem/db/transaction';

import { AsyncEventQueue } from './async-event-queue';
import { replayGenerationEvents } from './chat-generation-replay';
import { ChatGenerationStore } from './chat-generation-store';
import {
  recordGenerationEventDeduplicated,
  recordGenerationEventDelivery,
} from './chat-generation-telemetry';
import type {
  CancelInput,
  ChatGenerationDependencies,
  GenerationLookupInput,
  ReplayInput,
} from './chat-generation-types';

export async function replay(input: ReplayInput): Promise<AsyncIterable<GenerationEvent>> {
  const afterSequence = input.afterSequence ?? 0;
  const subscriber = ChatGenerationStore.subscribe(input.generationId);
  const queue = new AsyncEventQueue<GenerationEvent>(() => subscriber.close());
  void (async () => {
    try {
      for await (const event of replayGenerationEvents(
        {
          load: () =>
            ChatGenerationRepository.listEvents(
              db,
              input.generationId,
              input.ownerUserId,
              afterSequence,
            ),
          subscribe: () => subscriber,
          stopAfterLoad: input.terminal === true,
          onDelivery: recordGenerationEventDelivery,
          onDeduplicated: recordGenerationEventDeduplicated,
        },
        afterSequence,
      )) {
        queue.push(event);
      }
      queue.close();
    } finally {
      subscriber.close();
    }
  })().catch((error: unknown) => queue.fail(error));
  return queue;
}

export async function getGeneration(
  input: GenerationLookupInput,
): Promise<Awaited<ReturnType<typeof ChatRepository.getGenerationRun>>> {
  await ChatRepository.getOwnedOrThrow(db, input.chatId, input.ownerUserId);
  const run = await ChatRepository.getGenerationRun(
    db,
    input.chatId,
    input.generationId,
    input.ownerUserId,
  );
  return run;
}

export async function cancel(
  dependencies: ChatGenerationDependencies,
  input: CancelInput,
): Promise<Awaited<ReturnType<typeof ChatRepository.cancelGenerationRun>>> {
  await ChatRepository.getOwnedOrThrow(db, input.chatId, input.ownerUserId);
  await dependencies.failureHooks?.beforeCancellationCommit?.();
  const requestedAt = new Date().toISOString();
  try {
    await runInTransaction(async (trx): Promise<void> => {
      const run = await ChatRepository.getGenerationRunById(
        trx,
        input.generationId,
        input.ownerUserId,
      );
      if (!run || ['committed', 'cancelled', 'failed'].includes(run.status)) return;

      if (run.status === 'preparing') {
        await ChatGenerationRepository.appendEvent(trx, {
          generationId: input.generationId,
          ownerUserId: input.ownerUserId,
          event: {
            type: 'generation.started',
            context: {
              chatId: run.chatId,
              kind: run.kind,
              userMessageId: run.userMessageId,
              targetAssistantMessageId: run.targetAssistantMessageId,
              requestContext: {},
            },
          },
          idempotencyKey: `${input.generationId}:started`,
        });
      }
      await ChatGenerationRepository.appendEvent(trx, {
        generationId: input.generationId,
        ownerUserId: input.ownerUserId,
        event: {
          type: 'generation.cancel_requested',
          requestedAt,
          requestedBy: input.ownerUserId,
        },
        idempotencyKey: `${input.generationId}:cancel-requested`,
      });
      await ChatGenerationRepository.appendEvent(trx, {
        generationId: input.generationId,
        ownerUserId: input.ownerUserId,
        event: { type: 'generation.cancelled' },
        idempotencyKey: `${input.generationId}:cancelled`,
      });
    });
  } catch (error) {
    if (!(error instanceof GenerationProjectionError)) throw error;
  }
  return ChatRepository.getGenerationRunById(db, input.generationId, input.ownerUserId);
}
