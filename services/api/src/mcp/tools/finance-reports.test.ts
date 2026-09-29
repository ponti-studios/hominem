import { db, pool, sql } from '@hominem/db/core';
import { FINANCE_TRANSACTION_ENTITY_TYPE } from '@hominem/finance-services';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { callTool, type McpToolResult } from '../tool-registry';
import './finance';

const userId = 'f2000000-0000-4000-8000-000000000001';
const otherUserId = 'f2000000-0000-4000-8000-000000000002';

const checkingId = 'f2000003-0000-4000-8000-000000000001';
const cardId = 'f2000003-0000-4000-8000-000000000002';
const otherCheckingId = 'f2000003-0000-4000-8000-000000000003';
const foodTagId = 'f2000005-0000-4000-8000-000000000001';
const otherFoodTagId = 'f2000005-0000-4000-8000-000000000002';

type Row = Record<string, unknown>;
type Content = {
  accounts?: Row[];
  merchants?: Row[];
  breakdown?: Row[];
  transactions?: Row[];
  liquidAccounts?: Row[];
  weeks?: Row[];
  count?: number;
  filteredCount?: number;
  [key: string]: unknown;
};

function content(res: McpToolResult<Content>): Content {
  return res.structuredContent ?? {};
}

async function removeUser(id: string) {
  await pool.query(
    `DELETE FROM app.tag_assignments WHERE tag_id IN (SELECT id FROM app.tags WHERE owner_userid = $1)`,
    [id],
  );
  await pool.query(`DELETE FROM app.tags WHERE owner_userid = $1`, [id]);
  await pool.query(`DELETE FROM app.finance_transactions WHERE user_id = $1`, [id]);
  await pool.query(`DELETE FROM app.finance_accounts WHERE user_id = $1`, [id]);
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
}

async function seedUser(id: string, name: string) {
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)`,
    [id, name, `${id}@test.hominem.dev`, true],
  );
}

async function insertAccount(
  id: string,
  owner: string,
  name: string,
  accountType: string,
  includeInNetWorth = true,
) {
  await db
    .insertInto('app.financeAccounts')
    .values({
      id,
      userId: owner,
      name,
      accountType,
      currencyCode: 'USD',
      lifecycleStatus: 'open',
      includeInNetWorth,
      metadata: {},
    })
    .execute();
}

let txCounter = 0;
async function insertTransaction(input: {
  owner: string;
  accountId: string;
  postedOn: string;
  description: string;
  merchantName: string | null;
  amount: number;
  transactionType?: string;
  excluded?: boolean;
  recurring?: boolean;
}): Promise<string> {
  txCounter += 1;
  const id = `f2000004-0000-4000-8000-${String(txCounter).padStart(12, '0')}`;
  await db
    .insertInto('app.financeTransactions')
    .values({
      id,
      userId: input.owner,
      accountId: input.accountId,
      postedOn: input.postedOn,
      description: input.description,
      merchantName: input.merchantName,
      amount: input.amount,
      currencyCode: 'USD',
      transactionType: input.transactionType ?? (input.amount < 0 ? 'debit' : 'credit'),
      pending: false,
      externalId: `report-${txCounter}`,
      excluded: input.excluded ?? false,
      recurring: input.recurring ?? false,
      providerPayload: {},
    })
    .execute();
  return id;
}

async function tag(owner: string, tagId: string, name: string, transactionIds: string[]) {
  await db
    .insertInto('app.tags')
    .values({ id: tagId, ownerUserid: owner, name, path: name, slug: name.toLowerCase() })
    .execute();
  for (const transactionId of transactionIds) {
    await db
      .insertInto('app.tagAssignments')
      .values({
        tagId,
        entityTable: sql<string>`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`,
        entityId: transactionId,
      })
      .execute();
  }
}

beforeAll(async () => {
  await removeUser(userId);
  await removeUser(otherUserId);
  await seedUser(userId, 'Report User');
  await seedUser(otherUserId, 'Other Report User');

  await insertAccount(checkingId, userId, 'Checking', 'checking');
  await insertAccount(cardId, userId, 'Card', 'credit_card', false);
  await insertAccount(otherCheckingId, otherUserId, 'Other Checking', 'checking');

  const groceries = await insertTransaction({
    owner: userId,
    accountId: checkingId,
    postedOn: '2026-07-01',
    description: 'Grocery Store',
    merchantName: 'Whole Foods',
    amount: -50,
  });
  await insertTransaction({
    owner: userId,
    accountId: checkingId,
    postedOn: '2026-07-05',
    description: 'Gas',
    merchantName: 'Shell',
    amount: -25,
  });
  await insertTransaction({
    owner: userId,
    accountId: checkingId,
    postedOn: '2026-07-10',
    description: 'Paycheck',
    merchantName: 'Acme',
    amount: 2000,
  });
  const cardGroceries = await insertTransaction({
    owner: userId,
    accountId: cardId,
    postedOn: '2026-07-12',
    description: 'Groceries again',
    merchantName: 'Whole Foods',
    amount: -30,
  });
  await insertTransaction({
    owner: userId,
    accountId: checkingId,
    postedOn: '2026-07-15',
    description: 'Rent',
    merchantName: null,
    amount: -1000,
    recurring: true,
  });
  await insertTransaction({
    owner: userId,
    accountId: checkingId,
    postedOn: '2026-07-16',
    description: 'Shell refund adjustment',
    merchantName: 'Shell',
    amount: -10,
    transactionType: 'adjustment',
    excluded: true,
  });
  await tag(userId, foodTagId, 'Food', [groceries, cardGroceries]);

  const otherGroceries = await insertTransaction({
    owner: otherUserId,
    accountId: otherCheckingId,
    postedOn: '2026-07-02',
    description: 'Other Grocery Store',
    merchantName: 'Whole Foods',
    amount: -999,
  });
  await tag(otherUserId, otherFoodTagId, 'Food', [otherGroceries]);
});

afterAll(async () => {
  await removeUser(userId);
  await removeUser(otherUserId);
});

const JULY = { from: '2026-07-01', to: '2026-07-31' };

describe('finance_accounts', () => {
  it('lists every open account, including those outside net worth', async () => {
    const data = content(await callTool(userId, 'finance_accounts', { includeClosed: false }));
    expect(data.count).toBe(2);
    const byName = Object.fromEntries((data.accounts ?? []).map((a) => [a.name, a]));
    expect(byName.Card).toMatchObject({
      accountType: 'credit_card',
      balanceCents: -3000,
      includeInNetWorth: false,
    });
    expect(byName.Checking).toMatchObject({ accountType: 'checking', includeInNetWorth: true });
  });

  it("never returns another user's accounts", async () => {
    const data = content(await callTool(otherUserId, 'finance_accounts', { includeClosed: true }));
    expect(data.accounts?.map((a) => a.name)).toEqual(['Other Checking']);
  });

  it('reports totalCount alongside the returned accounts', async () => {
    const data = content(await callTool(userId, 'finance_accounts', { includeClosed: false }));
    expect(data.totalCount).toBe(2);
    expect(data.count).toBe(2);
  });
});

describe('finance_top_merchants', () => {
  it('ranks merchants by spend and skips excluded transactions', async () => {
    const data = content(await callTool(userId, 'finance_top_merchants', JULY));
    expect(data.merchants).toEqual([
      { name: 'Unknown', totalSpentCents: 100_000, transactionCount: 1 },
      { name: 'Whole Foods', totalSpentCents: 8000, transactionCount: 2 },
      { name: 'Shell', totalSpentCents: 2500, transactionCount: 1 },
    ]);
  });

  it('honors the account, date and tag filters', async () => {
    const byAccount = content(
      await callTool(userId, 'finance_top_merchants', { ...JULY, accountId: cardId }),
    );
    expect(byAccount.merchants).toEqual([
      { name: 'Whole Foods', totalSpentCents: 3000, transactionCount: 1 },
    ]);

    const byDate = content(
      await callTool(userId, 'finance_top_merchants', { from: '2026-07-11', to: '2026-07-31' }),
    );
    expect(byDate.merchants?.map((m) => m.name)).toEqual(['Unknown', 'Whole Foods']);

    const byTagName = content(await callTool(userId, 'finance_top_merchants', { tag: 'Food' }));
    expect(byTagName.merchants).toEqual([
      { name: 'Whole Foods', totalSpentCents: 8000, transactionCount: 2 },
    ]);

    const byTagId = content(await callTool(userId, 'finance_top_merchants', { tag: foodTagId }));
    expect(byTagId.merchants).toEqual(byTagName.merchants);
  });

  it("does not include another user's spending, even given their account id", async () => {
    const own = content(await callTool(otherUserId, 'finance_top_merchants', JULY));
    expect(own.merchants).toEqual([
      { name: 'Whole Foods', totalSpentCents: 99_900, transactionCount: 1 },
    ]);

    const crossAccount = content(
      await callTool(otherUserId, 'finance_top_merchants', { ...JULY, accountId: checkingId }),
    );
    expect(crossAccount.merchants).toEqual([]);
  });

  it('rejects an inverted date range', async () => {
    await expect(
      callTool(userId, 'finance_top_merchants', { from: '2026-08-01', to: '2026-07-01' }),
    ).rejects.toThrow();
  });
});

describe('finance_tag_breakdown', () => {
  it('splits spending by tag with shares of the total', async () => {
    const data = content(await callTool(userId, 'finance_tag_breakdown', { ...JULY, limit: 10 }));
    expect(data.totalSpendingCents).toBe(110_500);
    expect(data.breakdown).toEqual([
      {
        tag: 'Uncategorized',
        amountCents: 102_500,
        percentage: expect.any(Number),
        transactionCount: 2,
      },
      { tag: 'Food', amountCents: 8000, percentage: expect.any(Number), transactionCount: 2 },
    ]);
    const shares = (data.breakdown ?? []).reduce((sum, b) => sum + Number(b.percentage), 0);
    expect(shares).toBeCloseTo(100, 5);
  });

  it('restricts to one tag and never counts the other user', async () => {
    const own = content(await callTool(userId, 'finance_tag_breakdown', { tag: 'Food' }));
    expect(own.totalSpendingCents).toBe(8000);

    const other = content(await callTool(otherUserId, 'finance_tag_breakdown', { tag: 'Food' }));
    expect(other.totalSpendingCents).toBe(99_900);
  });

  it('totals spending across every tag even when the display limit truncates the breakdown', async () => {
    const limited = content(await callTool(userId, 'finance_tag_breakdown', { ...JULY, limit: 1 }));
    expect(limited.breakdown).toHaveLength(1);
    // Must still be the full total (Uncategorized 1025 + Food 80), not just the shown tag.
    expect(limited.totalSpendingCents).toBe(110_500);
  });

  it('derives the day span from the transaction range when only one bound is given', async () => {
    const openEnded = content(
      await callTool(userId, 'finance_tag_breakdown', { from: '2026-07-01', limit: 10 }),
    );
    // A real multi-day span must average out to less than treating the whole total as one day.
    expect(Number(openEnded.averagePerDayCents)).toBeLessThan(Number(openEnded.totalSpendingCents));
  });
});

describe('finance_monthly_stats', () => {
  it('totals income and expenses for the month', async () => {
    const data = content(await callTool(userId, 'finance_monthly_stats', { month: '2026-07' }));
    expect(data).toMatchObject({
      month: '2026-07',
      incomeCents: 200_000,
      expensesCents: 110_500,
      netCents: 89_500,
      transactionCount: 5,
      topMerchant: 'Unknown',
    });
  });

  it('is empty for a month with no activity and for a different user', async () => {
    const empty = content(await callTool(userId, 'finance_monthly_stats', { month: '2025-01' }));
    expect(empty).toMatchObject({ incomeCents: 0, expensesCents: 0, transactionCount: 0 });

    const other = content(
      await callTool(otherUserId, 'finance_monthly_stats', { month: '2026-07' }),
    );
    expect(other).toMatchObject({ incomeCents: 0, expensesCents: 99_900, transactionCount: 1 });
  });

  it('rejects a malformed month', async () => {
    await expect(callTool(userId, 'finance_monthly_stats', { month: 'July' })).rejects.toThrow();
  });

  it('rejects a month with no 13th calendar month', async () => {
    await expect(callTool(userId, 'finance_monthly_stats', { month: '2026-13' })).rejects.toThrow();
  });
});

describe('finance_transaction_search', () => {
  it('matches text against merchant names and descriptions', async () => {
    const byMerchant = content(
      await callTool(userId, 'finance_transaction_search', { query: 'whole foods' }),
    );
    expect(byMerchant.filteredCount).toBe(2);

    const byDescription = content(
      await callTool(userId, 'finance_transaction_search', { query: 'grocer' }),
    );
    expect(byDescription.filteredCount).toBe(2);
  });

  it('returns dollars as cents and flags excluded rows', async () => {
    const data = content(await callTool(userId, 'finance_transaction_search', { query: 'shell' }));
    expect(data.count).toBe(2);
    const excluded = data.transactions?.find((t) => t.excluded === true);
    expect(excluded).toMatchObject({ amountCents: -1000, description: 'Shell refund adjustment' });
    const kept = data.transactions?.find((t) => t.excluded === false);
    expect(kept).toMatchObject({ amountCents: -2500, merchantName: 'Shell' });
  });

  it('filters by account, tag and date, and pages with offset', async () => {
    const byAccount = content(
      await callTool(userId, 'finance_transaction_search', { accountId: cardId }),
    );
    expect(byAccount.transactions?.map((t) => t.description)).toEqual(['Groceries again']);

    const byTag = content(await callTool(userId, 'finance_transaction_search', { tag: 'Food' }));
    expect(byTag.filteredCount).toBe(2);

    const byDate = content(
      await callTool(userId, 'finance_transaction_search', {
        from: '2026-07-12',
        to: '2026-07-15',
      }),
    );
    expect(byDate.transactions?.map((t) => t.description)).toEqual(['Rent', 'Groceries again']);

    const firstPage = content(await callTool(userId, 'finance_transaction_search', { limit: 2 }));
    const secondPage = content(
      await callTool(userId, 'finance_transaction_search', { limit: 2, offset: 2 }),
    );
    expect(firstPage.filteredCount).toBe(6);
    const ids = [...(firstPage.transactions ?? []), ...(secondPage.transactions ?? [])].map(
      (t) => t.id,
    );
    expect(new Set(ids).size).toBe(4);
  });

  it("finds nothing for another user's account or tag", async () => {
    const byAccount = content(
      await callTool(otherUserId, 'finance_transaction_search', { accountId: checkingId }),
    );
    expect(byAccount.filteredCount).toBe(0);

    const ownFood = content(
      await callTool(otherUserId, 'finance_transaction_search', { tag: 'Food' }),
    );
    expect(ownFood.transactions?.map((t) => t.amountCents)).toEqual([-99_900]);
  });
});

describe('finance_runway', () => {
  it('projects from liquid accounts only', async () => {
    const data = content(
      await callTool(userId, 'finance_runway', {
        asOf: '2026-07-31',
        projectionWeeks: 4,
        monthlyBudgets: [{ category: 'Food', amountCents: 40_000 }],
      }),
    );
    expect(data.liquidAccounts).toEqual([{ accountName: 'Checking', balanceCents: 92_500 }]);
    expect(data.startingCashCents).toBe(92_500);
    expect(data.recurringTxnCount).toBe(1);
    expect(data.weeks).toHaveLength(4);
    expect(Number(data.weeklyRecurringOutflowCents)).toBeGreaterThan(0);
  });

  it("does not see another user's accounts", async () => {
    const data = content(await callTool(otherUserId, 'finance_runway', { asOf: '2026-07-31' }));
    expect(data.liquidAccounts).toEqual([{ accountName: 'Other Checking', balanceCents: -99_900 }]);
    expect(data.recurringTxnCount).toBe(0);
  });

  it('rejects a projection longer than a year', async () => {
    await expect(callTool(userId, 'finance_runway', { projectionWeeks: 200 })).rejects.toThrow();
  });
});

describe('finance_budget_breakdown', () => {
  it('splits income 50/30/20', async () => {
    const data = content(
      await callTool(userId, 'finance_budget_breakdown', { monthlyIncomeCents: 500_000 }),
    );
    expect(data).toEqual({
      needsCents: 250_000,
      wantsCents: 150_000,
      savingsCents: 100_000,
      unallocatedCents: 0,
    });
  });

  it('leaves the rest unallocated when the savings target is below the 20% cap', async () => {
    const data = content(
      await callTool(userId, 'finance_budget_breakdown', {
        monthlyIncomeCents: 500_000,
        savingsTargetCents: 10_000,
      }),
    );
    expect(data).toMatchObject({ savingsCents: 10_000, unallocatedCents: 90_000 });
  });

  it('caps the savings target at 20% when the requested target exceeds it', async () => {
    const data = content(
      await callTool(userId, 'finance_budget_breakdown', {
        monthlyIncomeCents: 500_000,
        savingsTargetCents: 150_000,
      }),
    );
    expect(data).toMatchObject({ savingsCents: 100_000, unallocatedCents: 0 });
  });

  it('always sums to the supplied income, even when percentages round unevenly', async () => {
    for (const monthlyIncomeCents of [1, 2, 3, 7, 11, 99, 101, 333]) {
      const data = content(
        await callTool(userId, 'finance_budget_breakdown', { monthlyIncomeCents }),
      );
      const total =
        Number(data.needsCents ?? 0) +
        Number(data.wantsCents ?? 0) +
        Number(data.savingsCents ?? 0) +
        Number(data.unallocatedCents ?? 0);
      expect(total).toBe(monthlyIncomeCents);
    }
  });
});
