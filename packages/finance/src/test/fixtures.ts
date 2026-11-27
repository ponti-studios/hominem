import { randomUUID } from 'node:crypto';

import { authDb, db } from '@hominem/db/core';
import { ensureIntegrationUsers } from '@hominem/db/test/utils';
import { sql } from 'kysely';
import { test } from 'vitest';

import { FINANCE_TRANSACTION_ENTITY_TYPE } from './contracts';

export interface FinanceIntegrationFixture {
  ownerId: string;
  otherUserId: string;
}

export const financeIntegrationTest = test.extend<{ financeFixture: FinanceIntegrationFixture }>({
  financeFixture: async ({ task: _task }, use) => {
    const fixture = {
      ownerId: randomUUID(),
      otherUserId: randomUUID(),
    };

    await ensureIntegrationUsers([
      { id: fixture.ownerId, name: 'Finance Integration Owner' },
      { id: fixture.otherUserId, name: 'Finance Integration Other User' },
    ]);

    try {
      await use(fixture);
    } finally {
      await cleanupIntegrationFinanceUser(fixture.ownerId);
      await cleanupIntegrationFinanceUser(fixture.otherUserId);
    }
  },
});

export async function cleanupIntegrationFinanceUser(userId: string): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('app.financeMonthlyBudgets').where('userId', '=', userId).execute();
    await trx.deleteFrom('app.financeRunwayPreferences').where('userId', '=', userId).execute();
    // Rules hold a RESTRICT reference to categories, so they go before the categories do.
    await trx.deleteFrom('app.financeRules').where('userId', '=', userId).execute();
    await trx
      .deleteFrom('app.tagAssignments')
      .where('entityTable', '=', sql<string>`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`)
      .where('entityId', 'in', (eb) =>
        eb.selectFrom('app.financeTransactions').select('id').where('userId', '=', userId),
      )
      .execute();
    await trx.deleteFrom('app.financeTransactions').where('userId', '=', userId).execute();
    await trx.deleteFrom('app.tags').where('ownerUserid', '=', userId).execute();
    await trx.deleteFrom('app.financeCategories').where('userId', '=', userId).execute();
    await trx.deleteFrom('app.financeAccounts').where('userId', '=', userId).execute();
  });

  await authDb.deleteFrom('user').where('id', '=', userId).execute();
}
