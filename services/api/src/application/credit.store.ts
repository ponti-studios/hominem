import { db, runInTransaction, sql } from '@hominem/db/core';

import type { CreditStore } from './credit';

/** The database side of the credit rules. Server-only tables: no owner policy. */
export const dbCreditStore: CreditStore = {
  async ledgerPence(userId) {
    const row = await db
      .selectFrom('app.creditLedger')
      .select(sql<string>`coalesce(sum(amount_pence), 0)`.as('total'))
      .where('userId', '=', userId)
      .executeTakeFirstOrThrow();
    return Number(row.total);
  },

  async lastAddedPence(userId) {
    const row = await db
      .selectFrom('app.creditLedger')
      .select('amountPence')
      .where('userId', '=', userId)
      .where('kind', 'in', ['grant', 'topup'])
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .limit(1)
      .executeTakeFirst();
    return row?.amountPence ?? 0;
  },

  async hasLedger(userId) {
    const row = await db
      .selectFrom('app.creditLedger')
      .select('id')
      .where('userId', '=', userId)
      .limit(1)
      .executeTakeFirst();
    return row !== undefined;
  },

  async grantsSince(since) {
    const row = await db
      .selectFrom('app.creditLedger')
      .select(sql<string>`count(*)`.as('total'))
      .where('kind', '=', 'grant')
      .where('createdAt', '>=', since.toISOString())
      .executeTakeFirstOrThrow();
    return Number(row.total);
  },

  async addGrant(userId, pence) {
    const inserted = await db
      .insertInto('app.creditLedger')
      .values({ userId, kind: 'grant', amountPence: pence })
      .onConflict((conflict) => conflict.doNothing())
      .returning('id')
      .executeTakeFirst();
    return inserted !== undefined;
  },

  async recordPayment({ sessionId, userId, amountPence, creditPence, status }) {
    return runInTransaction(async (trx) => {
      const inserted = await trx
        .insertInto('app.creditPayments')
        .values({ stripeSessionId: sessionId, userId, amountPence, creditPence, status })
        .onConflict((conflict) => conflict.doNothing())
        .returning('stripeSessionId')
        .executeTakeFirst();
      if (inserted === undefined) return 'duplicate' as const;
      if (status === 'credited') {
        await trx
          .insertInto('app.creditLedger')
          .values({ userId, kind: 'topup', amountPence: creditPence })
          .execute();
      }
      return 'new' as const;
    });
  },

  async paymentFor(userId, sessionId) {
    const row = await db
      .selectFrom('app.creditPayments')
      .select(['status', 'creditPence'])
      .where('stripeSessionId', '=', sessionId)
      .where('userId', '=', userId)
      .executeTakeFirst();
    if (!row) return null;
    return {
      status: row.status === 'credited' ? 'credited' : 'refunded_not_uk',
      creditPence: row.creditPence,
    };
  },

  async lowNotifiedAt(userId) {
    const row = await db
      .selectFrom('app.creditState')
      .select('lowNotifiedAt')
      .where('userId', '=', userId)
      .executeTakeFirst();
    return row?.lowNotifiedAt ? new Date(row.lowNotifiedAt) : null;
  },

  async setLowNotified(userId, at) {
    await sql`
      INSERT INTO app.credit_state (user_id, low_notified_at)
      VALUES (${userId}, ${at})
      ON CONFLICT (user_id) DO UPDATE SET low_notified_at = EXCLUDED.low_notified_at
    `.execute(db);
  },
};
