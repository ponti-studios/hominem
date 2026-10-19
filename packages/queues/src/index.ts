import type { Queue } from 'bullmq';
import { Queue as BullQueue } from 'bullmq';

import { DEFAULT_JOB_OPTIONS, QUEUE_NAMES } from './consts';
import { redis } from './redis';

export * from './types';
export * from './service';
export * from './consts';
export { redis } from './redis';

function createQueue(name: string): Queue {
  return new BullQueue(name, { connection: redis, defaultJobOptions: DEFAULT_JOB_OPTIONS });
}

export const plaidSyncQueue = createQueue(QUEUE_NAMES.PLAID_SYNC);

export const placePhotoEnrichQueue = createQueue(QUEUE_NAMES.PLACE_PHOTO_ENRICH);

export const fileProcessingQueue = createQueue(QUEUE_NAMES.FILE_PROCESSING);

export const embeddingQueue = createQueue(QUEUE_NAMES.EMBEDDING_GENERATION);

export const resumeAnalysisQueue = createQueue(QUEUE_NAMES.RESUME_ANALYSIS);

export const careerJobImportQueue = createQueue(QUEUE_NAMES.CAREER_JOB_IMPORT);

export const speechUsageReconciliationQueue = createQueue(QUEUE_NAMES.SPEECH_USAGE_RECONCILIATION);

export const chatFileCleanupQueue = createQueue(QUEUE_NAMES.CHAT_FILE_CLEANUP);

export const chatGenerationEffectsQueue = createQueue(QUEUE_NAMES.CHAT_GENERATION_EFFECTS);
