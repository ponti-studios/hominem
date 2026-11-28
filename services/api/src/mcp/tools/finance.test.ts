import {
  removeTransactions,
  removeUsers,
  resetUsers,
  seedAccounts,
  seedCategory,
  seedRepeatedTransactions,
  seedTransactions,
} from '@hominem/finance-services/test/factory';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { structuredContent } from '../../testkit/fixtures/mcp-content';
import { callTool } from '../tool-registry';
import './finance';

const userId = 'f1000000-0000-4000-8000-000000000001';

const checkingId = 'f1000003-0000-4000-8000-000000000001';

type TestResultRow = Record<string, unknown>;
type TestResultContent = {
  warnings?: unknown[];
  accounts?: TestResultRow[];
  totals?: unknown[];
  count?: number;
  transactions?: TestResultRow[];
  currencyCode?: string;
  categories?: TestResultRow[];
};

const resultContent = structuredContent<TestResultContent>;

const savingsId = 'f1000003-0000-4000-8000-000000000002';
const excludedCardId = 'f1000003-0000-4000-8000-000000000003';
const foodId = 'f1000002-0000-4000-8000-000000000101';
const transportId = 'f1000002-0000-4000-8000-000000000102';

beforeAll(async () => {
  await resetUsers(userId);
  await seedAccounts(userId, [
    { id: checkingId, name: 'Checking' },
    { id: savingsId, name: 'Old Savings', accountType: 'savings', lifecycleStatus: 'closed' },
    {
      id: excludedCardId,
      name: 'Excluded Card',
      accountType: 'credit_card',
      includeInNetWorth: false,
    },
  ]);
  await seedCategory({ id: foodId, userId, name: 'Food & Drink' });
  await seedCategory({ id: transportId, userId, name: 'Transport' });
  await seedTransactions(userId, [
    {
      id: 'f1000004-0000-4000-8000-000000000001',
      accountId: checkingId,
      postedOn: '2026-07-01',
      description: 'Grocery Store',
      amount: -50,
      transactionType: 'debit',
      externalId: 'fp-1',
      categoryId: foodId,
    },
    {
      id: 'f1000004-0000-4000-8000-000000000002',
      accountId: checkingId,
      postedOn: '2026-07-05',
      description: 'Gas Station',
      amount: -25,
      transactionType: 'debit',
      externalId: 'fp-2',
      categoryId: transportId,
    },
    {
      id: 'f1000004-0000-4000-8000-000000000003',
      accountId: checkingId,
      postedOn: '2026-07-10',
      description: 'Paycheck',
      amount: 2000,
      transactionType: 'credit',
      externalId: 'fp-3',
    },
    {
      id: 'f1000004-0000-4000-8000-000000000004',
      accountId: checkingId,
      postedOn: '2026-07-11',
      description: 'Transfer to Savings',
      amount: -100,
      transactionType: 'transfer',
      externalId: 'fp-4',
    },
    {
      id: 'f1000004-0000-4000-8000-000000000005',
      accountId: checkingId,
      postedOn: '2026-07-12',
      description: 'Pending Coffee',
      amount: -4.5,
      transactionType: 'debit',
      externalId: 'fp-5',
      categoryId: foodId,
      pending: true,
    },
    {
      id: 'f1000004-0000-4000-8000-000000000006',
      accountId: checkingId,
      postedOn: '2026-07-13',
      description: 'Excluded Reimbursement',
      amount: -10,
      transactionType: 'adjustment',
      externalId: 'fp-6',
      categoryId: foodId,
      excluded: true,
    },
  ]);
});

afterAll(() => removeUsers(userId));

describe('finance_net_worth', () => {
  it('sums posted, non-pending transaction activity to compute balances', async () => {
    const result = await callTool(userId, 'finance_net_worth', {
      includeClosed: false,
    });

    expect(result.structuredContent).toBeTruthy();
    const data = resultContent(result);

    expect(data.warnings).toEqual([]);
    expect(data.accounts).toHaveLength(1);
    expect(data.accounts?.[0]).toMatchObject({
      name: 'Checking',
      balance: 1815,
    });
    expect(data.totals).toEqual([{ currencyCode: 'USD', total: 1815, accountCount: 1 }]);
  });

  it('excludes closed accounts unless requested', async () => {
    const withoutClosed = await callTool(userId, 'finance_net_worth', {
      includeClosed: false,
    });
    expect(resultContent(withoutClosed).accounts?.map((a) => a.name)).toEqual(['Checking']);

    const withClosed = await callTool(userId, 'finance_net_worth', {
      includeClosed: true,
    });
    const names = resultContent(withClosed)
      .accounts?.map((a) => a.name)
      .sort();
    expect(names).toEqual(['Checking', 'Old Savings']);
  });
});

describe('finance_recent_transactions', () => {
  it('returns posted transactions only, newest first, with category names', async () => {
    const result = await callTool(userId, 'finance_recent_transactions', {
      limit: 20,
    });

    expect(resultContent(result).count).toBe(5);
    const descriptions = resultContent(result).transactions?.map((t) => t.description);
    expect(descriptions).toEqual([
      'Excluded Reimbursement',
      'Transfer to Savings',
      'Paycheck',
      'Gas Station',
      'Grocery Store',
    ]);

    const grocery = resultContent(result).transactions?.find(
      (t) => t.description === 'Grocery Store',
    );
    expect(grocery).toMatchObject({
      categoryName: 'Food & Drink',
      amount: -50,
      excluded: false,
    });

    const pending = resultContent(result).transactions?.find(
      (t) => t.description === 'Pending Coffee',
    );
    expect(pending).toBeUndefined();
  });
});

describe('finance_spending_by_category', () => {
  it('sums posted, non-excluded, non-transfer spending by category', async () => {
    const result = await callTool(userId, 'finance_spending_by_category', {
      from: '2026-06-30',
      to: '2026-07-20',
    });

    expect(resultContent(result).currencyCode).toBe('USD');
    expect(resultContent(result).warnings).toEqual([]);
    expect(resultContent(result).categories).toHaveLength(2);
    expect(resultContent(result).categories?.[0]).toEqual({
      categoryId: foodId,
      categoryName: 'Food & Drink',
      currencyCode: 'USD',
      spent: 50,
      transactionCount: 1,
    });
    expect(resultContent(result).categories?.[1]).toEqual({
      categoryId: transportId,
      categoryName: 'Transport',
      currencyCode: 'USD',
      spent: 25,
      transactionCount: 1,
    });
  });

  it('rejects unsupported parameters rather than falling back to the default window', async () => {
    await expect(
      callTool(userId, 'finance_spending_by_category', { period: '2026-09' }),
    ).rejects.toThrow();
  });

  it('keeps category sums separate when the range contains multiple currencies', async () => {
    const ids = ['f1000004-0000-4000-8000-000000000007', 'f1000004-0000-4000-8000-000000000008'];
    try {
      await seedTransactions(userId, [
        {
          id: ids[0]!,
          accountId: checkingId,
          postedOn: '2026-08-01',
          description: 'USD category sample',
          amount: -10,
          categoryId: foodId,
        },
        {
          id: ids[1]!,
          accountId: checkingId,
          postedOn: '2026-08-02',
          description: 'GBP category sample',
          amount: -20,
          currencyCode: 'GBP',
          categoryId: foodId,
        },
      ]);

      const data = resultContent(
        await callTool(userId, 'finance_spending_by_category', {
          from: '2026-08-01',
          to: '2026-08-31',
        }),
      );
      expect(data.currencyCode).toBeNull();
      expect(data.categories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            categoryName: 'Food & Drink',
            currencyCode: 'USD',
            spent: 10,
          }),
          expect.objectContaining({
            categoryName: 'Food & Drink',
            currencyCode: 'GBP',
            spent: 20,
          }),
        ]),
      );
    } finally {
      await removeTransactions(...ids);
    }
  });

  it('aggregates all matching rows at store scale without a transaction scan cap', async () => {
    const ids = await seedRepeatedTransactions(10_001, {
      userId,
      accountId: checkingId,
      postedOn: '2026-08-15',
      description: 'spending-cap-regression',
      amount: -0.01,
      transactionType: 'debit',
      categoryId: foodId,
    });
    try {
      const data = resultContent(
        await callTool(userId, 'finance_spending_by_category', {
          from: '2026-08-01',
          to: '2026-08-31',
        }),
      );
      expect(data.categories).toContainEqual(
        expect.objectContaining({
          categoryId: foodId,
          currencyCode: 'USD',
          spent: 100.01,
          transactionCount: 10_001,
        }),
      );
    } finally {
      await removeTransactions(...ids);
    }
  });
});
