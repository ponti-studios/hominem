import { QUEUE_NAMES, type MessagingInboundQueuePayload } from '@hominem/queues';
import { redis } from '@hominem/services/redis';
import { logger } from '@hominem/telemetry';
import { Worker } from 'bullmq';

import { processTelegramUpdate } from '../messaging/telegram-inbound';
import { getWorkerConcurrency } from './concurrency';

let worker: Worker<MessagingInboundQueuePayload> | null = null;

export function startMessagingInboundWorker() {
  if (worker) return worker;
  worker = new Worker<MessagingInboundQueuePayload>(
    QUEUE_NAMES.MESSAGING_INBOUND,
    async (job) => processTelegramUpdate(job.data.update, job.data.updateId),
    { connection: redis, concurrency: getWorkerConcurrency(QUEUE_NAMES.MESSAGING_INBOUND) },
  );
  worker.on('failed', (job, error) => {
    logger.error('messaging_inbound_job_failed', {
      updateId: job?.data.updateId,
      errorName: error.name,
    });
  });
  return worker;
}
