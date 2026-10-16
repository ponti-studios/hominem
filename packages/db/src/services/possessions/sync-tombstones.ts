import { sql } from 'kysely';

import { db } from '../../db';
import type { DbHandle } from '../../transaction';

// Durable delete log for library sync (see migration 20261016000000 and
// docs/sync-contract.md). Every remove path records here in the same
// transaction as the hard delete, so a delta pull can never miss a deletion.

export const SYNC_TOMBSTONE_TABLES = [
  'app.possessions',
  'app.possession_containers',
  'app.collections',
  'app.collection_items',
] as const;

export type SyncTombstoneTable = (typeof SYNC_TOMBSTONE_TABLES)[number];

export interface SyncTombstone {
  entityTable: SyncTombstoneTable;
  entityId: string;
  collectionId: string | null;
  deletedAt: string;
}

function toTombstone(row: {
  entityTable: string;
  entityId: string;
  collectionId: string | null;
  deletedAt: string;
}): SyncTombstone {
  const table = SYNC_TOMBSTONE_TABLES.find((candidate) => candidate === row.entityTable);
  if (!table) throw new Error(`Unexpected tombstone entity table: ${row.entityTable}`);
  return {
    entityTable: table,
    entityId: row.entityId,
    collectionId: row.collectionId,
    deletedAt: row.deletedAt,
  };
}

/** Records a deletion. Call with the same handle as the delete itself. */
export async function recordTombstone(
  handle: DbHandle,
  ownerUserId: string,
  entityTable: SyncTombstoneTable,
  entityId: string,
  collectionId?: string,
): Promise<void> {
  await handle
    .insertInto('app.syncTombstones')
    .values({
      ownerUserid: ownerUserId,
      entityTable,
      entityId,
      collectionId: collectionId ?? null,
    })
    .execute();
}

/** Tombstones for one owner's tables deleted after `since` (ISO), oldest first. */
export async function listTombstones(
  handle: DbHandle,
  ownerUserId: string,
  entityTables: readonly SyncTombstoneTable[],
  since: string,
): Promise<SyncTombstone[]> {
  const rows = await handle
    .selectFrom('app.syncTombstones')
    .select(['entityTable', 'entityId', 'collectionId', 'deletedAt'])
    .where('ownerUserid', '=', ownerUserId)
    .where('entityTable', 'in', [...entityTables])
    .where('deletedAt', '>', since)
    .orderBy('deletedAt', 'asc')
    .execute();
  return rows.map(toTombstone);
}

/** The database clock: delta cursors come from here, never the client. */
export async function serverTime(): Promise<Date> {
  const result = await sql<{ now: Date | string }>`select now()`.execute(db);
  const raw = result.rows[0]?.now;
  const date = raw instanceof Date ? raw : new Date(raw ?? 0);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
