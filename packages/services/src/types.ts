// BullMQ types
import type { Queue } from 'bullmq';

/**
 * Common queue shape used across API, workers, and apps
 */
export type Queues = {
  importTransactions: Queue;
  placePhotoEnrich: Queue;
};
