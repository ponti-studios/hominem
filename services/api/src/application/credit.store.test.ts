import { pool } from '@hominem/db/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { dbCreditStore } from './credit.store';

const userId = 'd4000000-0000-4000-8000-000000000031';
const otherId = 'd4000000-0000-4000-8000-000000000032';
const thirdId = 'd4000000-0000-4000-8000-000000000033';

async function clean() {
  for (const id of [userId, otherId, thirdId]) {
    await pool.query(`DELETE FROM app.credit_state WHERE user_id = $1`, [id]);
    await pool.query(`DELETE FROM app.credit_payments WHERE user_id = $1`, [id]);
    await pool.query(`DELETE FROM app.credit_ledger WHERE user_id = $1`, [id]);
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
  }
}

beforeAll(async () => {
  await clean();
  for (const [id, email] of [
    [userId, 'credit-store-test@work.hominem.dev'],
    [otherId, 'credit-store-other@work.hominem.dev'],
    [thirdId, 'credit-store-third@work.hominem.dev'],
  ] as const) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)`,
      [id, 'Credit Store Test User', email, true],
    );
  }
});

afterAll(async () => {
  await clean();
  await pool.end();
});

describe('dbCreditStore', () => {
  it('starts empty', async () => {
    expect(await dbCreditStore.hasLedger(userId)).toBe(false);
    expect(await dbCreditStore.ledgerPence(userId)).toBe(0);
    expect(await dbCreditStore.lastAddedPence(userId)).toBe(0);
  });

  it('gives one grant per person', async () => {
    const since = new Date(Date.now() - 60_000);
    expect(await dbCreditStore.grantIfRoom({ userId, pence: 100, since, max: 100 })).toBe('added');
    expect(await dbCreditStore.grantIfRoom({ userId, pence: 100, since, max: 100 })).toBe('has');
    expect(await dbCreditStore.ledgerPence(userId)).toBe(100);
    expect(await dbCreditStore.lastAddedPence(userId)).toBe(100);
    expect(await dbCreditStore.hasLedger(userId)).toBe(true);
  });

  it('stops giving grants once the day is full, even when asked at the same moment', async () => {
    const since = new Date(Date.now() - 60_000);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM app.credit_ledger WHERE kind = 'grant' AND created_at >= $1`,
      [since],
    );
    const max = rows[0].n + 1;
    const results = await Promise.all(
      [otherId, thirdId].map((id) =>
        dbCreditStore.grantIfRoom({ userId: id, pence: 100, since, max }),
      ),
    );
    expect(results.filter((result) => result === 'added')).toHaveLength(1);
    expect(results.filter((result) => result === 'full')).toHaveLength(1);
  });

  it('credits a payment once, whatever the retries', async () => {
    const input = {
      sessionId: 'cs_test_store_1',
      userId,
      amountPence: 1000,
      creditPence: 819,
      status: 'credited' as const,
    };
    expect(await dbCreditStore.recordPayment(input)).toBe('new');
    expect(await dbCreditStore.recordPayment(input)).toBe('duplicate');
    expect(await dbCreditStore.ledgerPence(userId)).toBe(100 + 819);
    expect(await dbCreditStore.lastAddedPence(userId)).toBe(819);
  });

  it('records a refunded payment without adding credit', async () => {
    const before = await dbCreditStore.ledgerPence(userId);
    expect(
      await dbCreditStore.recordPayment({
        sessionId: 'cs_test_store_2',
        userId,
        amountPence: 1000,
        creditPence: 819,
        status: 'refunded_not_uk',
      }),
    ).toBe('new');
    expect(await dbCreditStore.ledgerPence(userId)).toBe(before);
  });

  it('remembers when the low-credit email went out, and forgets on a top-up', async () => {
    expect(await dbCreditStore.lowNotifiedAt(userId)).toBeNull();
    const at = new Date('2026-10-18T10:00:00Z');
    await dbCreditStore.setLowNotified(userId, at);
    expect((await dbCreditStore.lowNotifiedAt(userId))?.toISOString()).toBe(at.toISOString());
    await dbCreditStore.setLowNotified(userId, null);
    expect(await dbCreditStore.lowNotifiedAt(userId)).toBeNull();
  });
});
