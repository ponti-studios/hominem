import { type Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import type { AppProactivityActions, Json } from '../../types/database';

type ActionRow = Selectable<AppProactivityActions>;

export type ProactivityActionKind = 'task.create' | 'goal.pause' | 'finding.snooze';
export type ProactivityActionStatus = 'applied' | 'undone';

export const PROACTIVITY_ACTION_KINDS: readonly ProactivityActionKind[] = [
  'task.create',
  'goal.pause',
  'finding.snooze',
];

export interface ProactivityActionRecord {
  id: string;
  ownerUserId: string;
  triggerId: string;
  goalId: string;
  kind: ProactivityActionKind;
  status: ProactivityActionStatus;
  payload: unknown;
  inverse: unknown;
  appliedAt: string;
  undoneAt: string | null;
  createdAt: string;
}

export interface InsertProactivityActionInput {
  ownerId: string;
  triggerId: string;
  goalId: string;
  kind: ProactivityActionKind;
  payload: unknown;
  inverse: unknown;
}

function toActionRecord(row: ActionRow): ProactivityActionRecord {
  const kind = PROACTIVITY_ACTION_KINDS.find((candidate) => candidate === row.kind);
  if (!kind) {
    throw new Error(`Unknown proactivity action kind in app.proactivity_actions: ${row.kind}`);
  }
  const status = row.status === 'undone' ? 'undone' : 'applied';
  return {
    id: row.id,
    ownerUserId: row.ownerUserid,
    triggerId: row.triggerId,
    goalId: row.goalId,
    kind,
    status,
    payload: row.payload,
    inverse: row.inverse,
    appliedAt: new Date(row.appliedAt).toISOString(),
    undoneAt: row.undoneAt ? new Date(row.undoneAt).toISOString() : null,
    createdAt: new Date(row.createdat).toISOString(),
  };
}

/**
 * Actions the person approved. Insertion is idempotent per open finding and
 * kind, so a repeat tap returns the action that is already applied.
 */
export const ProactivityActionsRepository = {
  async findApplied(
    handle: DbHandle,
    input: { userId: string; triggerId: string; goalId: string; kind: ProactivityActionKind },
  ): Promise<ProactivityActionRecord | null> {
    const row = await handle
      .selectFrom('app.proactivityActions')
      .selectAll()
      .where('ownerUserid', '=', input.userId)
      .where('triggerId', '=', input.triggerId)
      .where('goalId', '=', input.goalId)
      .where('kind', '=', input.kind)
      .where('status', '=', 'applied')
      .executeTakeFirst();
    return row ? toActionRecord(row) : null;
  },

  async insertApplied(
    handle: DbHandle,
    input: InsertProactivityActionInput,
  ): Promise<ProactivityActionRecord> {
    const inserted = await handle
      .insertInto('app.proactivityActions')
      .values({
        ownerUserid: input.ownerId,
        triggerId: input.triggerId,
        goalId: input.goalId,
        kind: input.kind,
        payload: input.payload as Json,
        inverse: input.inverse as Json,
      })
      .onConflict((conflict) => conflict.doNothing())
      .returningAll()
      .executeTakeFirst();
    if (inserted) return toActionRecord(inserted);

    const existing = await ProactivityActionsRepository.findApplied(handle, {
      userId: input.ownerId,
      triggerId: input.triggerId,
      goalId: input.goalId,
      kind: input.kind,
    });
    if (!existing) throw new Error('Proactivity action conflict resolved without a stored row.');
    return existing;
  },

  async findOwned(
    handle: DbHandle,
    input: { id: string; userId: string },
  ): Promise<ProactivityActionRecord | null> {
    const row = await handle
      .selectFrom('app.proactivityActions')
      .selectAll()
      .where('id', '=', input.id)
      .where('ownerUserid', '=', input.userId)
      .executeTakeFirst();
    return row ? toActionRecord(row) : null;
  },

  async listForTrigger(
    handle: DbHandle,
    input: { userId: string; triggerId: string },
  ): Promise<ProactivityActionRecord[]> {
    const rows = await handle
      .selectFrom('app.proactivityActions')
      .selectAll()
      .where('ownerUserid', '=', input.userId)
      .where('triggerId', '=', input.triggerId)
      .orderBy('appliedAt', 'desc')
      .execute();
    return rows.map(toActionRecord);
  },

  async markUndone(
    handle: DbHandle,
    input: { id: string; userId: string },
  ): Promise<ProactivityActionRecord | null> {
    const row = await handle
      .updateTable('app.proactivityActions')
      .set({ status: 'undone', undoneAt: new Date() })
      .where('id', '=', input.id)
      .where('ownerUserid', '=', input.userId)
      .where('status', '=', 'applied')
      .returningAll()
      .executeTakeFirst();
    return row ? toActionRecord(row) : null;
  },
};
