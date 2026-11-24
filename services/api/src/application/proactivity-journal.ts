import { db } from '@hominem/db/core';
import { ProactivityRunsRepository } from '@hominem/db/proactivity';
import {
  evaluationRunSchema,
  type EvaluationJournal,
  type EvaluationRun,
} from '@hominem/proactivity';

/**
 * The engine's journal over Postgres. A run is a durable record the moment the
 * engine commits it, so a decision made in the worker survives a restart and is
 * readable from the HTTP server; `find` gives the engine its idempotent replay.
 */
export const postgresJournal: EvaluationJournal = {
  async find(ownerId, triggerId) {
    const record = await ProactivityRunsRepository.findByTrigger(db, {
      userId: ownerId,
      triggerId,
    });
    return record ? evaluationRunSchema.parse(record.run) : null;
  },
  async commit(run) {
    const record = await ProactivityRunsRepository.commit(db, {
      ownerId: run.ownerId,
      triggerId: run.triggerId,
      processedAt: run.processedAt,
      run,
    });
    return evaluationRunSchema.parse(record.run);
  },
};

/** The owner's most recent stored run, validated as it leaves the database. */
export async function loadLatestRun(userId: string): Promise<EvaluationRun | null> {
  const record = await ProactivityRunsRepository.latestForOwner(db, { userId });
  return record ? evaluationRunSchema.parse(record.run) : null;
}
