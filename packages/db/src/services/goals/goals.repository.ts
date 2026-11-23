import { type Selectable } from 'kysely';

import { NotFoundError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type { AppGoals } from '../../types/database';

type GoalRow = Selectable<AppGoals>;

export type GoalStatus = 'active' | 'paused' | 'achieved';

export interface GoalRecord {
  id: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  domains: string[];
  targetAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalInput {
  userId: string;
  title: string;
  description?: string | null;
  status?: GoalStatus;
  domains?: string[];
  targetAt?: string | null;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string | null;
  status?: GoalStatus;
  domains?: string[];
  targetAt?: string | null;
}

export const GOAL_STATUSES: readonly GoalStatus[] = ['active', 'paused', 'achieved'];

function toGoalRecord(row: GoalRow): GoalRecord {
  const status = GOAL_STATUSES.find((candidate) => candidate === row.status);
  if (!status) {
    throw new Error(`Unknown goal status in app.goals: ${row.status}`);
  }
  return {
    id: row.id,
    ownerUserId: row.ownerUserid,
    title: row.title,
    description: row.description ?? null,
    status,
    domains: row.domains,
    targetAt: row.targetAt ? new Date(row.targetAt).toISOString() : null,
    createdAt: new Date(row.createdat).toISOString(),
    updatedAt: new Date(row.updatedat).toISOString(),
  };
}

export const GoalsRepository = {
  async listByOwner(handle: DbHandle, input: { userId: string }): Promise<GoalRecord[]> {
    const rows = await handle
      .selectFrom('app.goals')
      .selectAll()
      .where('ownerUserid', '=', input.userId)
      .orderBy('createdat', 'desc')
      .execute();
    return rows.map(toGoalRecord);
  },

  async getOwned(
    handle: DbHandle,
    input: { id: string; userId: string },
  ): Promise<GoalRecord | null> {
    const row = await handle
      .selectFrom('app.goals')
      .selectAll()
      .where('id', '=', input.id)
      .where('ownerUserid', '=', input.userId)
      .executeTakeFirst();
    return row ? toGoalRecord(row) : null;
  },

  async create(handle: DbHandle, input: CreateGoalInput): Promise<GoalRecord> {
    const row = await handle
      .insertInto('app.goals')
      .values({
        ownerUserid: input.userId,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? 'active',
        domains: input.domains ?? [],
        targetAt: input.targetAt ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toGoalRecord(row);
  },

  async update(
    handle: DbHandle,
    input: { id: string; userId: string } & UpdateGoalInput,
  ): Promise<GoalRecord> {
    const row = await handle
      .updateTable('app.goals')
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.domains !== undefined ? { domains: input.domains } : {}),
        ...(input.targetAt !== undefined ? { targetAt: input.targetAt } : {}),
        updatedat: new Date(),
      })
      .where('id', '=', input.id)
      .where('ownerUserid', '=', input.userId)
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw new NotFoundError('Goal', { goalId: input.id });
    }
    return toGoalRecord(row);
  },

  async delete(handle: DbHandle, input: { id: string; userId: string }): Promise<boolean> {
    const result = await handle
      .deleteFrom('app.goals')
      .where('id', '=', input.id)
      .where('ownerUserid', '=', input.userId)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  },
};
