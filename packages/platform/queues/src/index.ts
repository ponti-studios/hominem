import { QUEUE_NAMES } from './consts';
import type { Queue } from 'bullmq';
import { Queue as BullQueue } from 'bullmq';

import { redis } from './redis';

export * from './types';
export * from './service';
export * from './consts';

/**
 * Initialize BullMQ queues using consistent queue names.
 * These are singleton instances used throughout the application.
 */
export const importTransactionsQueue: Queue = new BullQueue(QUEUE_NAMES.IMPORT_TRANSACTIONS, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: redis as any,
});

export const placePhotoEnrichQueue: Queue = new BullQueue(QUEUE_NAMES.PLACE_PHOTO_ENRICH, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: redis as any,
});

export const fileProcessingQueue: Queue = new BullQueue(QUEUE_NAMES.FILE_PROCESSING, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: redis as any,
});
