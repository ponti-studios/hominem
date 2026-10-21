import {
  QUEUE_NAMES,
  chatGenerationEffectsQueue,
  type ChatGenerationEffectsQueuePayload,
} from '@hominem/queues';
import { redis } from '@hominem/services/redis';
import { logger } from '@hominem/telemetry';
import { Worker } from 'bullmq';

import { processReadyChatGenerationEffects } from '../application/chat-generation-effects.service';
import { getWorkerConcurrency } from './concurrency';

let worker: Worker<ChatGenerationEffectsQueuePayload> | null = null;

export async function startChatGenerationEffectsWorker() {
  if (worker) return worker;

  await chatGenerationEffectsQueue.upsertJobScheduler(
    'pending-effects',
    { every: 15_000 },
    {
      name: 'dispatch',
      opts: {
        removeOnComplete: true,
        removeOnFail: { age: 86_400, count: 1_000 },
      },
    },
  );
  await chatGenerationEffectsQueue.add(
    'dispatch',
    {},
    { jobId: 'chat-generation-effects-initial', removeOnComplete: true, removeOnFail: false },
  );

  worker = new Worker<ChatGenerationEffectsQueuePayload>(
    QUEUE_NAMES.CHAT_GENERATION_EFFECTS,
    async () => {
      const result = await processReadyChatGenerationEffects();
      if (result.found > 0) {
        logger.info('chat_generation_effect_batch_completed', result);
      }
    },
    {
      connection: redis,
      concurrency: getWorkerConcurrency(QUEUE_NAMES.CHAT_GENERATION_EFFECTS),
    },
  );

  worker.on('failed', (_job, error) => {
    logger.error('chat_generation_effect_dispatch_failed', {
      errorName: error.name,
    });
  });

  return worker;
}
