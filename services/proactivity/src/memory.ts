import { evaluationRunSchema, type EvaluationJournal, type EvaluationRun } from './types.js';

export class InMemoryJournal implements EvaluationJournal {
  private readonly runs = new Map<string, EvaluationRun>();

  find(ownerId: string, triggerId: string): Promise<EvaluationRun | null> {
    return Promise.resolve(this.runs.get(runKey(ownerId, triggerId)) ?? null);
  }

  commit(input: EvaluationRun): Promise<EvaluationRun> {
    const run = evaluationRunSchema.parse(input);
    const key = runKey(run.ownerId, run.triggerId);
    const existing = this.runs.get(key);
    if (existing) return Promise.resolve(existing);
    this.runs.set(key, run);
    return Promise.resolve(run);
  }
}

const runKey = (ownerId: string, triggerId: string): string => `${ownerId}:${triggerId}`;
