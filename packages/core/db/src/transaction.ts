import type { Kysely, Transaction } from 'kysely';

import { db } from './db';
import type { DB } from './types/database';

/**
 * A transaction-scoped database handle.
 * Repositories accept this so callers can compose writes atomically.
 */
export type TransactionHandle = Transaction<DB>;

/**
 * A database handle that works with or without a transaction.
 * Repositories use this as their `db` parameter so the same code
 * runs inside or outside a transaction.
 */
export type DbHandle = Kysely<DB> | TransactionHandle;

/**
 * Run a callback inside a database transaction.
 *
 * The callback receives a `TransactionHandle` that repositories
 * can accept to participate in the transaction.
 *
 * If the callback throws, the transaction is rolled back.
 * If it returns, the transaction is committed.
 *
 * @example
 * ```ts
 * const note = await runInTransaction(async (trx) => {
 *   const created = await noteRepo.create(trx, { ... });
 *   await noteFileRepo.sync(trx, created.id, userId, fileIds);
 *   return created;
 * });
 * ```
 */
export async function runInTransaction<T>(
  fn: (trx: TransactionHandle) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(fn);
}

/**
 * Returns the default (non-transactional) database handle.
 * Use this for read-only queries or single-statement writes
 * that don't need atomicity guarantees.
 */
export function getDb(): Kysely<DB> {
  return db;
}
