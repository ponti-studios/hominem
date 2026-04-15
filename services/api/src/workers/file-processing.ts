import { FileRepository, getDb } from '@hominem/db';
import { FileProcessorService } from '@hominem/services/files';
import { QUEUE_NAMES } from '@hominem/utils/consts';
import { fileStorageService } from '@hominem/utils/storage';
import { logger } from '@hominem/utils/logger';
import { Worker } from 'bullmq';

import { redis as cache } from '@hominem/services/redis';

let worker: Worker | null = null;

interface FileProcessingJobData {
  jobId: string;
  userId: string;
  fileId: string;
  storageKey: string;
  url: string;
  originalName: string;
  mimetype: string;
  size: number;
}

export async function processFileUploadJob(data: FileProcessingJobData) {
  const storedBuffer = await fileStorageService.getFileByPath(data.storageKey);
  if (!storedBuffer) {
    logger.error('[files] processing skipped, file buffer missing', { fileId: data.fileId });
    return;
  }

  const arrayBuffer = storedBuffer.buffer.slice(
    storedBuffer.byteOffset,
    storedBuffer.byteOffset + storedBuffer.byteLength,
  ) as ArrayBuffer;

  const processed = await FileProcessorService.processFile(
    arrayBuffer,
    data.originalName,
    data.mimetype,
    data.fileId,
  );

  await FileRepository.upsert(getDb(), {
    id: data.fileId,
    userId: data.userId,
    storageKey: data.storageKey,
    originalName: data.originalName,
    mimetype: data.mimetype,
    size: data.size,
    url: data.url,
    ...(processed.content != null ? { content: processed.content } : {}),
    ...(processed.textContent != null ? { textContent: processed.textContent } : {}),
    ...(processed.metadata != null ? { metadata: processed.metadata } : {}),
  });
}

export function startFileProcessingWorker() {
  if (worker) {
    return worker;
  }

  worker = new Worker(QUEUE_NAMES.FILE_PROCESSING, async (job) => processFileUploadJob(job.data), {
    connection: cache,
  });

  worker.on('failed', (job, error) => {
    logger.error('[files] processing job failed', {
      jobId: job?.id,
      error,
    });
  });

  return worker;
}
