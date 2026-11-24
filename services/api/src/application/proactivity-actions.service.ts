import { db } from '@hominem/db/core';
import { NotFoundError, ValidationError } from '@hominem/db/errors';
import { GoalsRepository } from '@hominem/db/goals';
import {
  ProactivityActionsRepository,
  type ProactivityActionKind,
  type ProactivityActionRecord,
} from '@hominem/db/proactivity';
import { TaskRepository } from '@hominem/db/tasks';
import type { ProactivityActionView } from '@hominem/proactivity';

import { postgresJournal } from './proactivity-journal';

const DAY_MS = 86_400_000;

export type ApplyProactivityActionInput = {
  triggerId: string;
  goalId: string;
  kind: ProactivityActionKind;
};

export function toActionView(record: ProactivityActionRecord): ProactivityActionView {
  const payload =
    record.payload && typeof record.payload === 'object'
      ? (record.payload as Record<string, unknown>)
      : {};
  return {
    id: record.id,
    triggerId: record.triggerId,
    goalId: record.goalId,
    kind: record.kind,
    status: record.status,
    taskId: typeof payload.taskId === 'string' ? payload.taskId : null,
    until: typeof payload.until === 'string' ? payload.until : null,
    appliedAt: record.appliedAt,
    undoneAt: record.undoneAt,
  };
}

/** 09:00 the day after the action was taken, in UTC. */
function nextMorning(from: Date): string {
  const due = new Date(from.getTime() + DAY_MS);
  due.setUTCHours(9, 0, 0, 0);
  return due.toISOString();
}

/**
 * Applies one action the inbox offered for a finding. The run is the source of
 * truth: the goal and the decision must both belong to it, and the action is
 * idempotent per finding and kind.
 */
export async function applyProactivityAction(
  userId: string,
  input: ApplyProactivityActionInput,
): Promise<ProactivityActionView> {
  const open = await ProactivityActionsRepository.findApplied(db, {
    userId,
    triggerId: input.triggerId,
    goalId: input.goalId,
    kind: input.kind,
  });
  if (open) return toActionView(open);

  const run = await postgresJournal.find(userId, input.triggerId);
  if (!run) throw new NotFoundError('Evaluation run', { triggerId: input.triggerId });
  const evaluation = run.evaluations.find((row) => row.goalId === input.goalId);
  if (!evaluation) {
    throw new NotFoundError('Evaluation', { triggerId: input.triggerId, goalId: input.goalId });
  }
  const goal = await GoalsRepository.getOwned(db, { id: input.goalId, userId });
  if (!goal) throw new NotFoundError('Goal', { goalId: input.goalId });

  const now = new Date();
  const record = await (async (): Promise<ProactivityActionRecord> => {
    switch (input.kind) {
      case 'task.create': {
        if (evaluation.decision.kind !== 'propose') {
          throw new ValidationError('Only a proposal can become a task');
        }
        const title = evaluation.decision.nextStep.slice(0, 180);
        const dueAt = nextMorning(now);
        const task = await TaskRepository.create(db, {
          userId,
          title,
          description: `From your goal: ${goal.title}`,
          artifactType: 'task',
          dueAt,
        });
        return ProactivityActionsRepository.insertApplied(db, {
          ownerId: userId,
          triggerId: input.triggerId,
          goalId: input.goalId,
          kind: input.kind,
          payload: { taskId: task.id, title, dueAt },
          inverse: { kind: 'task.delete', taskId: task.id },
        });
      }
      case 'goal.pause': {
        if (goal.status !== 'active') {
          throw new ValidationError('Only an active goal can be paused');
        }
        await GoalsRepository.update(db, { id: goal.id, userId, status: 'paused' });
        return ProactivityActionsRepository.insertApplied(db, {
          ownerId: userId,
          triggerId: input.triggerId,
          goalId: input.goalId,
          kind: input.kind,
          payload: { goalId: goal.id, previousStatus: goal.status },
          inverse: { kind: 'goal.setStatus', status: goal.status },
        });
      }
      case 'finding.snooze': {
        return ProactivityActionsRepository.insertApplied(db, {
          ownerId: userId,
          triggerId: input.triggerId,
          goalId: input.goalId,
          kind: input.kind,
          payload: { until: new Date(now.getTime() + 3 * DAY_MS).toISOString() },
          inverse: { kind: 'noop' },
        });
      }
    }
  })();

  // A concurrent tap may have won the unique index; the insert returns that row.
  return toActionView(record);
}

/** Reverses an applied action. Undoing an already-undone action is a no-op. */
export async function undoProactivityAction(
  userId: string,
  actionId: string,
): Promise<ProactivityActionView> {
  const action = await ProactivityActionsRepository.findOwned(db, { id: actionId, userId });
  if (!action) throw new NotFoundError('Proactivity action', { actionId });
  if (action.status !== 'applied') return toActionView(action);

  const inverse =
    action.inverse && typeof action.inverse === 'object'
      ? (action.inverse as Record<string, unknown>)
      : {};

  if (inverse.kind === 'task.delete' && typeof inverse.taskId === 'string') {
    await TaskRepository.remove(db, inverse.taskId, userId).catch((error: unknown) => {
      if (!(error instanceof NotFoundError)) throw error;
    });
  } else if (inverse.kind === 'goal.setStatus' && typeof inverse.status === 'string') {
    const status = inverse.status === 'paused' ? 'paused' : 'active';
    await GoalsRepository.update(db, { id: action.goalId, userId, status });
  }

  const undone = await ProactivityActionsRepository.markUndone(db, {
    id: action.id,
    userId,
  });
  return toActionView(
    undone ?? { ...action, status: 'undone', undoneAt: new Date().toISOString() },
  );
}
