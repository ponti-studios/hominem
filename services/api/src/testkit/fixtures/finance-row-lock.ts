import { pool } from '@hominem/db/core';

/**
 * Edits a transaction's notes inside an open database transaction, so a test can line another
 * writer up behind the row lock and then decide when the edit lands.
 */
export async function openNoteEdit(userId: string, transactionId: string, notes: string) {
  const client = await pool.connect();
  await client.query('BEGIN');
  await client.query(
    'UPDATE app.finance_transactions SET notes = $1 WHERE id = $2 AND user_id = $3',
    [notes, transactionId, userId],
  );
  const { rows } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
  const blockerPid = rows[0]!.pid;
  let committed = false;

  return {
    /** Resolves true once another session is waiting on this edit, false after `timeoutMs`. */
    async waitForBlockedWriter(timeoutMs = 5000): Promise<boolean> {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const status = await pool.query<{ blocked: boolean }>(
          'SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS blocked',
          [blockerPid],
        );
        if (status.rows[0]!.blocked) return true;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return false;
    },
    async commit() {
      await client.query('COMMIT');
      committed = true;
    },
    /** Rolls back if never committed, and always hands the connection back. */
    async release() {
      if (!committed) await client.query('ROLLBACK');
      client.release();
    },
  };
}
