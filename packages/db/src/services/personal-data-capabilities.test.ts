import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { authDb, db } from '../db';
import { FinanceQueryRepository } from './finance/finance-query.repository';

const runIntegration = process.env.NODE_ENV === 'test' ? describe : describe.skip;

runIntegration('personal data read capabilities', () => {
  const userIds: string[] = [];
  const institutionIds: string[] = [];

  afterEach(async () => {
    for (const userId of userIds.splice(0)) {
      await db.deleteFrom('app.financeTransactions').where('userId', '=', userId).execute();
      await db.deleteFrom('app.financeAccounts').where('userId', '=', userId).execute();
      await authDb.deleteFrom('user').where('id', '=', userId).execute();
    }

    for (const institutionId of institutionIds.splice(0)) {
      await db.deleteFrom('app.financeInstitutions').where('id', '=', institutionId).execute();
    }
  });

  async function createUser(): Promise<string> {
    const userId = randomUUID();
    userIds.push(userId);
    await authDb
      .insertInto('user')
      .values({ id: userId, name: 'Capabilities Test User', email: `${userId}@example.com` })
      .execute();
    return userId;
  }

  it('summarizes monthly spending and merchant destinations', async () => {
    const userId = await createUser();
    const institutionId = randomUUID();
    const accountId = randomUUID();
    institutionIds.push(institutionId);

    await db
      .insertInto('app.financeInstitutions')
      .values({ id: institutionId, name: 'Test Bank' })
      .execute();
    await db
      .insertInto('app.financeAccounts')
      .values({
        id: accountId,
        userId,
        institutionId,
        name: 'Personal Checking',
        accountType: 'checking',
      })
      .execute();
    await db
      .insertInto('app.financeTransactions')
      .values([
        {
          id: randomUUID(),
          userId,
          accountId,
          amount: -42.5,
          transactionType: 'debit',
          postedOn: '2026-03-03',
          merchantName: 'City Cafe',
          description: 'Coffee and lunch',
        },
        {
          id: randomUUID(),
          userId,
          accountId,
          amount: -120,
          transactionType: 'debit',
          postedOn: '2026-03-09',
          merchantName: 'Nashville Hotel',
          description: 'Hotel',
        },
        {
          id: randomUUID(),
          userId,
          accountId,
          amount: 2000,
          transactionType: 'credit',
          postedOn: '2026-03-31',
          merchantName: 'Client',
          description: 'Invoice',
        },
      ])
      .execute();

    const summary = await FinanceQueryRepository.monthlySummary(userId, { month: '2026-03' });

    expect(summary).toMatchObject({
      month: '2026-03',
      totalSpent: 162.5,
      totalIncome: 2000,
      transactionCount: 3,
    });
    expect(summary.topMerchants.map((merchant) => merchant.merchantName)).toEqual([
      'Nashville Hotel',
      'City Cafe',
    ]);
  });

  it('caps finance summary evidence and excludes transactions outside the month', async () => {
    const userId = await createUser();
    const institutionId = randomUUID();
    const accountId = randomUUID();
    institutionIds.push(institutionId);

    await db
      .insertInto('app.financeInstitutions')
      .values({ id: institutionId, name: 'Test Bank' })
      .execute();
    await db
      .insertInto('app.financeAccounts')
      .values({
        id: accountId,
        userId,
        institutionId,
        name: 'Personal Checking',
        accountType: 'checking',
      })
      .execute();
    await db
      .insertInto('app.financeTransactions')
      .values([
        {
          id: randomUUID(),
          userId,
          accountId,
          amount: -10,
          transactionType: 'debit',
          postedOn: '2026-03-01',
          merchantName: 'Coffee',
          description: 'Morning coffee',
        },
        {
          id: randomUUID(),
          userId,
          accountId,
          amount: -20,
          transactionType: 'debit',
          postedOn: '2026-03-02',
          merchantName: 'Lunch',
          description: 'Lunch',
        },
        {
          id: randomUUID(),
          userId,
          accountId,
          amount: 100,
          transactionType: 'credit',
          postedOn: '2026-03-03',
          merchantName: 'Client',
          description: 'Invoice',
        },
        {
          id: randomUUID(),
          userId,
          accountId,
          amount: -999,
          transactionType: 'debit',
          postedOn: '2026-04-01',
          merchantName: 'April',
          description: 'Out of range',
        },
      ])
      .execute();

    const summary = await FinanceQueryRepository.monthlySummary(userId, {
      month: '2026-03',
      limit: 2,
    });

    expect(summary).toMatchObject({
      month: '2026-03',
      startsOn: '2026-03-01',
      endsBefore: '2026-04-01',
      totalSpent: 30,
      totalIncome: 100,
      transactionCount: 3,
    });
    expect(summary.transactions).toHaveLength(2);
    expect(summary.topMerchants.map((merchant) => merchant.merchantName)).toEqual([
      'Lunch',
      'Coffee',
    ]);
    expect(JSON.stringify(summary)).not.toContain('Out of range');
    expect(JSON.stringify(summary)).not.toContain('providerPayload');
  });
});
