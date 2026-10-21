import type { JobsOptions } from 'bullmq';

export const QUEUE_NAMES = {
  FILE_PROCESSING: 'file-processing',
  EMBEDDING_GENERATION: 'embedding-generation',
  RESUME_ANALYSIS: 'resume-analysis',
  CAREER_JOB_IMPORT: 'career-job-import',
  SPEECH_USAGE_RECONCILIATION: 'speech-usage-reconciliation',
  CHAT_FILE_CLEANUP: 'chat-file-cleanup',
  CHAT_GENERATION_EFFECTS: 'chat-generation-effects',
} as const;

// Applied to every queue so completed/failed jobs cannot accumulate forever.
// A per-job option at an .add() call site still wins over these defaults.
export const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: { age: 86_400, count: 1_000 },
  removeOnFail: { age: 604_800, count: 1_000 },
} satisfies JobsOptions;

export const REDIS_CHANNELS = {
  IMPORT_PROGRESS: 'import:progress',
  SUBSCRIBE: 'import:subscribe',
  SUBSCRIBED: 'import:subscribed',
} as const;
