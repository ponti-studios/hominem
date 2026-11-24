import { type Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import type { AppProactivityRuns, Json } from '../../types/database';

type RunRow = Selectable<AppProactivityRuns>;

/**
 * One stored evaluation run. `run` is the engine's validated document; the
 * caller parses it against its own contract instead of db mirroring it.
 */
export interface ProactivityRunRecord {
  id: string;
  ownerUserId: string;
  triggerId: string;
  processedAt: string;
  run: unknown;
  createdAt: string;
}

export interface CommitProactivityRunInput {
  ownerId: string;
  triggerId: string;
  processedAt: string;
  run: unknown;
}

function toRunRecord(row: RunRow): ProactivityRunRecord {
  return {
    id: row.id,
    ownerUserId: row.ownerUserid,
    triggerId: row.triggerId,
    processedAt: new Date(row.processedAt).toISOString(),
    run: row.run,
    createdAt: new Date(row.createdat).toISOString(),
  };
}

/**
 * Stores evaluation runs. Commits are idempotent per (owner, trigger): a repeat
 * insert returns the run that is already stored, which is exactly the journal
 * contract the engine relies on.
 */
export const ProactivityRunsRepository = {
  async commit(handle: DbHandle, input: CommitProactivityRunInput): Promise<ProactivityRunRecord> {
    const inserted = await handle
      .insertInto('app.proactivityRuns')
      .values({
        ownerUserid: input.ownerId,
        triggerId: input.triggerId,
        processedAt: new Date(input.processedAt),
        run: input.run as Json,
      })
      .onConflict((conflict) => conflict.columns(['ownerUserid', 'triggerId']).doNothing())
      .returningAll()
      .executeTakeFirst();
    if (inserted) return toRunRecord(inserted);

    const existing = await handle
      .selectFrom('app.proactivityRuns')
      .selectAll()
      .where('ownerUserid', '=', input.ownerId)
      .where('triggerId', '=', input.triggerId)
      .executeTakeFirst();
    if (!existing) {
      throw new Error('Proactivity run conflict resolved without a stored row.');
    }
    return toRunRecord(existing);
  },

  async findByTrigger(
    handle: DbHandle,
    input: { userId: string; triggerId: string },
  ): Promise<ProactivityRunRecord | null> {
    const row = await handle
      .selectFrom('app.proactivityRuns')
      .selectAll()
      .where('ownerUserid', '=', input.userId)
      .where('triggerId', '=', input.triggerId)
      .executeTakeFirst();
    return row ? toRunRecord(row) : null;
  },

  async latestForOwner(
    handle: DbHandle,
    input: { userId: string },
  ): Promise<ProactivityRunRecord | null> {
    const row = await handle
      .selectFrom('app.proactivityRuns')
      .selectAll()
      .where('ownerUserid', '=', input.userId)
      .orderBy('processedAt', 'desc')
      .orderBy('createdat', 'desc')
      .executeTakeFirst();
    return row ? toRunRecord(row) : null;
  },
};
