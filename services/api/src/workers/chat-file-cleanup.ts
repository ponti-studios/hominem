import { QUEUE_NAMES, type ChatFileCleanupQueuePayload } from '@hominem/queues';
import { redis as cache } from '@hominem/services/redis';
import { fileStorageService } from '@hominem/storage';
import { logger } from '@hominem/telemetry';
import { Worker } from 'bullmq';

let worker: Worker | null = null;

export function startChatFileCleanupWorker() {
  if (worker) return worker;

  worker = new Worker<ChatFileCleanupQueuePayload>(
    QUEUE_NAMES.CHAT_FILE_CLEANUP,
    async (job) => {
      const { fileIds, userId } = job.data;
      await Promise.all(
        fileIds.map(async (fileId) => {
          const deleted = await fileStorageService.deleteFile(fileId, userId);
          if (!deleted) throw new Error(`Unable to delete chat file ${fileId}`);
        }),
      );
    },
    { connection: cache },
  );

  worker.on('failed', (job, error) => {
    logger.error('chat_file_cleanup_failed', {
      operation: 'chat.file_cleanup',
      failureType: 'chat.file_cleanup.failed',
      retryable: Boolean(job && job.attemptsMade < (job.opts.attempts ?? 1)),
      jobId: job?.id,
      error_name: error instanceof Error ? error.name : 'unknown',
    });
  });

  return worker;
}
