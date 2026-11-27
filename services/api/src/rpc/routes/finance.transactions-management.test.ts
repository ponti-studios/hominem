import {
  removeUsers,
  resetUsers,
  seedAccounts,
  seedCategory,
  seedTransactions,
} from '@hominem/finance-services/test/factory';
import { latestLiveRulebook, transactionsByIds } from '@hominem/finance-services/test/readers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { financeTestApp } from '../../testkit/fixtures/finance-rpc';
import { postJson } from '../../testkit/rpc-test-app';
import { transactionsRoutes } from './finance.transactions';

const userId = 'b4010001-0000-4000-8000-000000000001';
const accountA = 'b4010003-0000-4000-8000-000000000001';
const accountB = 'b4010003-0000-4000-8000-000000000002';
const categoryId = 'b4010005-0000-4000-8000-000000000001';
const expenseId = 'b4010006-0000-4000-8000-000000000001';
const incomeId = 'b4010006-0000-4000-8000-000000000002';

const app = financeTestApp('transactions', transactionsRoutes, userId);

beforeAll(async () => {
  await resetUsers(userId);
  await seedAccounts(userId, [
    { id: accountA, name: 'Checking' },
    { id: accountB, name: 'Savings' },
  ]);
  await seedCategory({ id: categoryId, userId, name: 'Dining' });
  await seedTransactions(userId, [
    {
      id: expenseId,
      accountId: accountA,
      amount: -20,
      description: 'Coffee Shop',
      merchantName: 'Coffee Shop',
      postedOn: '2026-11-10',
    },
    {
      id: incomeId,
      accountId: accountB,
      amount: 20,
      description: 'Transfer from Checking',
      merchantName: 'Coffee Shop',
      postedOn: '2026-11-10',
    },
  ]);
});

afterAll(() => removeUsers(userId));

describe('finance transaction management', () => {
  it('saves selected categories immediately and learns suggestion-only merchant rules', async () => {
    const response = await postJson(app, '/api/finance/transactions/batch', {
      ids: [expenseId],
      action: { action: 'category', categoryId },
    });
    expect(response.status).toBe(200);

    const [stored] = await transactionsByIds([expenseId]);
    expect(stored?.categoryId).toBe(categoryId);

    const rulebook = await latestLiveRulebook(userId);
    expect(rulebook?.contents).toHaveProperty(
      'merchantRules',
      expect.arrayContaining([{ merchant: 'Coffee Shop', category: 'Dining', tags: [] }]),
    );
  });

  it('links matching transactions and restores their original types when unlinked', async () => {
    const linked = await postJson(app, '/api/finance/transactions/transfer/pair', {
      ids: [expenseId, incomeId],
    });
    expect(linked.status).toBe(200);
    expect(await transactionsByIds([expenseId, incomeId])).toMatchObject([
      { id: expenseId, counterpartId: incomeId, transactionType: 'transfer' },
      { id: incomeId, counterpartId: expenseId, transactionType: 'transfer' },
    ]);

    const unlinked = await postJson(app, '/api/finance/transactions/transfer/unlink', {
      id: expenseId,
    });
    expect(unlinked.status).toBe(200);
    expect(await transactionsByIds([expenseId, incomeId])).toMatchObject([
      { id: expenseId, counterpartId: null, transactionType: 'debit' },
      { id: incomeId, counterpartId: null, transactionType: 'credit' },
    ]);
  });

  it('updates transaction details using the stored debit and credit types', async () => {
    const response = await postJson(app, '/api/finance/transactions/update', {
      id: expenseId,
      data: { amount: -25, merchantName: 'Coffee Shop', date: '2026-11-11' },
    });
    expect(response.status).toBe(200);
    const [updated] = await transactionsByIds([expenseId]);
    expect(Number(updated?.amount)).toBe(-25);
    expect(updated?.transactionType).toBe('debit');
  });
});
