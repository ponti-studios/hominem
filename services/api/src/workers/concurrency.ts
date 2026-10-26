import { QUEUE_NAMES } from '@hominem/queues';

// BullMQ defaults every worker to concurrency 1. I/O-bound queues can run in
// parallel; the dispatcher/serial queues stay at 1 because their order matters
// (airport catalogue sync is a full snapshot, chat effects drain in sequence).
const WORKER_CONCURRENCY: Record<string, number> = {
  [QUEUE_NAMES.EMBEDDING_GENERATION]: 5,
  [QUEUE_NAMES.FILE_PROCESSING]: 5,
  [QUEUE_NAMES.CHAT_GENERATION_EFFECTS]: 1,
  [QUEUE_NAMES.RESUME_ANALYSIS]: 2,
  [QUEUE_NAMES.SPEECH_USAGE_RECONCILIATION]: 2,
  [QUEUE_NAMES.CHAT_FILE_CLEANUP]: 2,
  'airport-catalogue-sync': 1,
};

export function getWorkerConcurrency(queueName: string): number {
  return WORKER_CONCURRENCY[queueName] ?? 2;
}
