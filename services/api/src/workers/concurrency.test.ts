import { QUEUE_NAMES } from '@hominem/queues';
import { describe, expect, it } from 'vitest';

import { getWorkerConcurrency } from './concurrency';

describe('worker concurrency', () => {
  it('parallelizes I/O-bound queues', () => {
    expect(getWorkerConcurrency(QUEUE_NAMES.EMBEDDING_GENERATION)).toBe(5);
    expect(getWorkerConcurrency(QUEUE_NAMES.FILE_PROCESSING)).toBe(5);
    expect(getWorkerConcurrency(QUEUE_NAMES.CAREER_JOB_IMPORT)).toBe(5);
  });

  it('keeps dispatcher and serial queues at one', () => {
    expect(getWorkerConcurrency(QUEUE_NAMES.CHAT_GENERATION_EFFECTS)).toBe(1);
    expect(getWorkerConcurrency('airport-catalogue-sync')).toBe(1);
  });

  it('defaults every other queue to two', () => {
    expect(getWorkerConcurrency(QUEUE_NAMES.RESUME_ANALYSIS)).toBe(2);
    expect(getWorkerConcurrency(QUEUE_NAMES.SPEECH_USAGE_RECONCILIATION)).toBe(2);
    expect(getWorkerConcurrency(QUEUE_NAMES.CHAT_FILE_CLEANUP)).toBe(2);
    expect(getWorkerConcurrency('not-a-queue')).toBe(2);
  });
});
