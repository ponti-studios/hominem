import { pool } from '@hominem/db/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { creditHistory, deleteAccount, exportAccount } from './account';

const userId = 'd4000000-0000-4000-8000-000000000041';
const otherId = 'd4000000-0000-4000-8000-000000000042';

async function clean() {
  for (const id of [userId, otherId]) {
    await pool.query(`DELETE FROM "oauthRefreshToken" WHERE "userId" = $1`, [id]);
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
  }
}

beforeAll(async () => {
  await clean();
  for (const [id, email] of [
    [userId, 'account-test@work.hominem.dev'],
    [otherId, 'account-other@work.hominem.dev'],
  ] as const) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)`,
      [id, 'Account Test User', email, true],
    );
    await pool.query(
      `INSERT INTO app.credit_ledger (user_id, kind, amount_pence) VALUES ($1, 'grant', 100)`,
      [id],
    );
    await pool
      .query(`INSERT INTO app.tags (owner_userid, name) VALUES ($1, 'mine')`, [id])
      .catch(() => undefined);
  }
});

afterAll(async () => {
  await clean();
  await pool.end();
});

describe('account download and delete', () => {
  it('downloads only this person, without secrets', async () => {
    const result = await exportAccount(userId);
    expect(result.user?.email).toBe('account-test@work.hominem.dev');
    expect(result.data['app.credit_ledger']).toHaveLength(1);
    expect(Object.keys(result.data)).not.toContain('session');
    expect(Object.keys(result.data)).not.toContain('app.mcp_tokens');
    expect(JSON.stringify(result)).not.toContain('account-other');
  });

  it('lists credit entries newest first', async () => {
    expect(await creditHistory(userId)).toMatchObject([{ kind: 'grant', amountPence: 100 }]);
  });

  it('ends keys, clears a refresh token, removes the person and leaves others', async () => {
    const endKeys = vi.fn(async () => undefined);
    const removeStoredFile = vi.fn(async () => undefined);
    await deleteAccount(userId, { endKeys, removeStoredFile });
    expect(endKeys).toHaveBeenCalledWith(userId);
    const gone = await pool.query(`SELECT 1 FROM "user" WHERE id = $1`, [userId]);
    expect(gone.rowCount).toBe(0);
    const ledger = await pool.query(`SELECT 1 FROM app.credit_ledger WHERE user_id = $1`, [userId]);
    expect(ledger.rowCount).toBe(0);
    const kept = await pool.query(`SELECT 1 FROM "user" WHERE id = $1`, [otherId]);
    expect(kept.rowCount).toBe(1);
  });
});
