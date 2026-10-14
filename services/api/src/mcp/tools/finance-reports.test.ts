import { db, pool, sql } from '@hominem/db/core';
import { FINANCE_TRANSACTION_ENTITY_TYPE } from '@hominem/finance-services';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { callTool, type McpToolResult } from '../tool-registry';
import './finance';

const userId = 'f2000000-0000-4000-8000-000000000001';
const otherUserId = 'f2000000-0000-4000-8000-000000000002';

const checkingId = 'f2000003-0000-4000-8000-000000000001';
const cardId = 'f2000003-0000-4000-8000-000000000002';
const otherCheckingId = 'f2000003-0000-4000-8000-000000000003';
const categoryGbpAccountId = 'f2000003-0000-4000-8000-000000000004';
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
  await pool.query(`DELETE FROM app.finance_categories WHERE user_id = $1`, [id]);
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
  currencyCode = 'USD',
) {
  await db
    .insertInto('app.financeAccounts')
    .values({
      id,
      userId: owner,
      name,
      accountType,
      currencyCode,
      lifecycleStatus: 'open',
      includeInNetWorth,
      metadata: {},
    })
    .execute();
}

let txCounter = 0;
const testTransactionIds: string[] = [];
const testTagIds: string[] = [];
async function insertTransaction(input: {
  owner: string;
  accountId: string;
  postedOn: string;
  description: string;
  merchantName: string | null;
  amount: number;
  currencyCode?: string;
  transactionType?: string;
  excluded?: boolean;
  recurring?: boolean;
  pending?: boolean;
}): Promise<string> {
  txCounter += 1;
  const id = `f2000004-0000-4000-8000-${String(txCounter).padStart(12, '0')}`;
  testTransactionIds.push(id);
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
      currencyCode: input.currencyCode ?? 'USD',
      transactionType: input.transactionType ?? (input.amount < 0 ? 'debit' : 'credit'),
      pending: input.pending ?? false,
      externalId: `report-${txCounter}`,
      excluded: input.excluded ?? false,
      recurring: input.recurring ?? false,
      providerPayload: {},
    })
    .execute();
  return id;
}

async function tag(owner: string, tagId: string, name: string, transactionIds: string[]) {
  testTagIds.push(tagId);
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
  testTransactionIds.length = 0;
  testTagIds.length = 0;
});

afterEach(async () => {
  if (testTransactionIds.length) {
    await pool.query('DELETE FROM app.tag_assignments WHERE entity_id = ANY($1::uuid[])', [
      testTransactionIds,
    ]);
    await pool.query('DELETE FROM app.finance_transactions WHERE id = ANY($1::uuid[])', [
      testTransactionIds,
    ]);
    testTransactionIds.length = 0;
  }
  if (testTagIds.length) {
    await pool.query('DELETE FROM app.tag_assignments WHERE tag_id = ANY($1::uuid[])', [
      testTagIds,
    ]);
    await pool.query('DELETE FROM app.tags WHERE id = ANY($1::uuid[])', [testTagIds]);
    testTagIds.length = 0;
  }
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

  it('aggregates all matching transactions beyond the analytics page size', async () => {
    for (let index = 0; index < 201; index += 1) {
      await insertTransaction({
        owner: userId,
        accountId: checkingId,
        postedOn: '2026-11-01',
        description: `Merchant page row ${index}`,
        merchantName: 'Paged Merchant',
        amount: -1,
      });
    }
    const data = content(
      await callTool(userId, 'finance_top_merchants', {
        from: '2026-11-01',
        to: '2026-11-30',
      }),
    );
    expect(data.merchants).toContainEqual({
      name: 'Paged Merchant',
      totalSpentCents: 20_100,
      transactionCount: 201,
    });
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

describe('finance_spending_by_category', () => {
  it('detects mixed currencies even when the category limit omits one', async () => {
    await insertAccount(categoryGbpAccountId, userId, 'Category GBP', 'checking', true, 'GBP');
    const usd = await insertTransaction({
      owner: userId,
      accountId: checkingId,
      postedOn: '2026-12-03',
      description: 'USD category limit row',
      merchantName: 'Category USD',
      amount: -10,
    });
    const gbp = await insertTransaction({
      owner: userId,
      accountId: categoryGbpAccountId,
      postedOn: '2026-12-03',
      description: 'GBP category limit row',
      merchantName: 'Category GBP',
      amount: -5,
      currencyCode: 'GBP',
    });
    const categoryIds = [
      'f2000006-0000-4000-8000-000000000001',
      'f2000006-0000-4000-8000-000000000002',
    ];
    await db
      .insertInto('app.financeCategories')
      .values([
        { id: categoryIds[0]!, userId, name: 'Category Limit USD' },
        { id: categoryIds[1]!, userId, name: 'Category Limit GBP' },
      ])
      .execute();
    await db
      .updateTable('app.financeTransactions')
      .set({ categoryId: categoryIds[0]! })
      .where('id', '=', usd)
      .execute();
    await db
      .updateTable('app.financeTransactions')
      .set({ categoryId: categoryIds[1]! })
      .where('id', '=', gbp)
      .execute();
    const data = content(
      await callTool(userId, 'finance_spending_by_category', {
        from: '2026-12-03',
        to: '2026-12-03',
        limit: 1,
      }),
    );
    expect(data.categories).toHaveLength(1);
    expect(data.currencyCode).toBeNull();
    expect(data.warnings).toContain(
      'Spending spans multiple currencies; categories are reported separately by currency.',
    );
  });

  it('reports when matching categories are omitted by the requested limit', async () => {
    const categoryIds = Array.from(
      { length: 21 },
      (_, index) => `f2000008-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    );
    await db
      .insertInto('app.financeCategories')
      .values(categoryIds.map((id, index) => ({ id, userId, name: `Limit Category ${index + 1}` })))
      .execute();

    for (const [index, categoryId] of categoryIds.entries()) {
      const transactionId = await insertTransaction({
        owner: userId,
        accountId: checkingId,
        postedOn: '2025-12-15',
        description: `Category truncation ${index + 1}`,
        merchantName: null,
        amount: -(index + 1),
      });
      await db
        .updateTable('app.financeTransactions')
        .set({ categoryId })
        .where('id', '=', transactionId)
        .execute();
    }

    const limited = content(
      await callTool(userId, 'finance_spending_by_category', {
        from: '2025-01-01',
        to: '2025-12-31',
      }),
    );
    expect(limited.categories).toHaveLength(20);
    expect(limited.truncated).toBe(true);
    expect(limited.warnings).toContain(
      'Category results are truncated at the requested limit (20); additional matching categories were omitted.',
    );

    const complete = content(
      await callTool(userId, 'finance_spending_by_category', {
        from: '2025-01-01',
        to: '2025-12-31',
        limit: 50,
      }),
    );
    expect(complete.categories).toHaveLength(21);
    expect(complete.truncated).toBe(false);
    expect(complete.warnings).not.toEqual(
      expect.arrayContaining([expect.stringContaining('truncated')]),
    );
  });
});

describe('finance_tag_breakdown', () => {
  it('splits spending by tag with shares of the total', async () => {
    const data = content(await callTool(userId, 'finance_tag_breakdown', { ...JULY, limit: 10 }));
    expect(data.totalSpendingCents).toBe(110_500);
    expect(data.breakdown).toEqual([
      {
        tag: '(untagged)',
        amountCents: 102_500,
        percentage: expect.any(Number),
        transactionCount: 2,
        currencyCode: 'USD',
      },
      {
        tag: 'Food',
        amountCents: 8000,
        percentage: expect.any(Number),
        transactionCount: 2,
        currencyCode: 'USD',
      },
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

  it('returns currency totals beyond the former result cap', async () => {
    for (let index = 0; index < 501; index += 1) {
      await insertTransaction({
        owner: userId,
        accountId: checkingId,
        postedOn: '2026-12-02',
        description: `Currency ${index}`,
        merchantName: 'Currency Report',
        amount: -1,
        currencyCode: `X${index.toString(36).toUpperCase().padStart(2, '0')}`,
      });
    }
    const data = content(
      await callTool(userId, 'finance_tag_breakdown', {
        from: '2026-12-02',
        to: '2026-12-02',
      }),
    );
    expect(data.totalsByCurrency).toHaveLength(500);
    expect(data.warnings).toContain('Currency totals truncated after 500 currencies.');
  });

  it('counts a co-tagged transaction under every assigned tag and distinguishes untagged spend', async () => {
    const transactionId = await insertTransaction({
      owner: userId,
      accountId: checkingId,
      postedOn: '2026-08-18',
      description: 'Co-tagged report test',
      merchantName: 'Report Test',
      amount: -14.95,
    });
    const artTagId = 'f2000005-0000-4000-8000-000000000003';
    await tag(userId, artTagId, 'Art', [transactionId]);
    const karenTagId = 'f2000005-0000-4000-8000-000000000004';
    await tag(userId, karenTagId, 'Karen', []);
    await db
      .insertInto('app.tagAssignments')
      .values({
        tagId: karenTagId,
        entityTable: sql<string>`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`,
        entityId: transactionId,
      })
      .execute();
    await insertTransaction({
      owner: userId,
      accountId: checkingId,
      postedOn: '2026-08-19',
      description: 'Untagged report test',
      merchantName: null,
      amount: -5,
    });

    const data = content(
      await callTool(userId, 'finance_tag_breakdown', {
        from: '2026-08-01',
        to: '2026-08-31',
        limit: 10,
      }),
    );
    expect(data.breakdown).toContainEqual(
      expect.objectContaining({ tag: 'Karen', amountCents: 1495, transactionCount: 1 }),
    );
    expect(data.breakdown).toContainEqual(
      expect.objectContaining({ tag: 'Art', amountCents: 1495, transactionCount: 1 }),
    );
    expect(data.breakdown).toContainEqual(expect.objectContaining({ tag: '(untagged)' }));
    expect(data.totalSpendingCents).toBe(1995);
    expect(data.totalsByCurrency).toEqual([
      expect.objectContaining({ currencyCode: 'USD', totalSpendingCents: 1995 }),
    ]);
  });

  it('ignores removed tag assignments but retains the transaction in untagged totals', async () => {
    const transactionId = await insertTransaction({
      owner: userId,
      accountId: checkingId,
      postedOn: '2026-12-01',
      description: 'Removed tag report test',
      merchantName: 'Report Test',
      amount: -12,
    });
    const removedTagId = 'f2000005-0000-4000-8000-000000000006';
    await tag(userId, removedTagId, 'Removed', [transactionId]);
    await db
      .updateTable('app.tagAssignments')
      .set({ removedAt: new Date(Date.now() + 60_000).toISOString() })
      .where('tagId', '=', removedTagId)
      .execute();
    const data = content(
      await callTool(userId, 'finance_tag_breakdown', {
        from: '2026-12-01',
        to: '2026-12-31',
        limit: 10,
      }),
    );
    expect(data.breakdown).toEqual([
      expect.objectContaining({ tag: '(untagged)', amountCents: 1200, transactionCount: 1 }),
    ]);
    expect(data.totalSpendingCents).toBe(1200);
  });

  it('returns zero totals for an empty range', async () => {
    const data = content(
      await callTool(userId, 'finance_tag_breakdown', {
        from: '2025-01-01',
        to: '2025-01-31',
      }),
    );
    expect(data).toMatchObject({
      totalSpendingCents: 0,
      averagePerDayCents: 0,
      currencyCode: null,
      totalsByCurrency: [],
    });
  });

  it('keeps tag totals and daily averages separate by currency', async () => {
    const usdId = await insertTransaction({
      owner: userId,
      accountId: checkingId,
      postedOn: '2026-08-20',
      description: 'USD tag sample',
      merchantName: 'Tag Sample',
      amount: -1,
    });
    const gbpId = await insertTransaction({
      owner: userId,
      accountId: checkingId,
      postedOn: '2026-08-21',
      description: 'GBP tag sample',
      merchantName: 'Tag Sample',
      amount: -2,
      currencyCode: 'GBP',
    });
    const tagId = 'f2000005-0000-4000-8000-000000000005';
    await tag(userId, tagId, 'currency_sample', [usdId, gbpId]);

    const data = content(
      await callTool(userId, 'finance_tag_breakdown', {
        from: '2026-08-01',
        to: '2026-08-31',
        limit: 10,
      }),
    );
    expect(data.currencyCode).toBeNull();
    expect(data.totalSpendingCents).toBeNull();
    expect(data.averagePerDayCents).toBeNull();
    expect(data.totalsByCurrency).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currencyCode: 'USD', totalSpendingCents: 100 }),
        expect.objectContaining({ currencyCode: 'GBP', totalSpendingCents: 200 }),
      ]),
    );
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

  it('reports mixed-currency totals independently instead of adding unlike currencies', async () => {
    await insertTransaction({
      owner: userId,
      accountId: checkingId,
      postedOn: '2026-09-21',
      description: 'GBP report test',
      merchantName: 'GBP Merchant',
      amount: -250,
      currencyCode: 'GBP',
    });
    await insertTransaction({
      owner: userId,
      accountId: checkingId,
      postedOn: '2026-09-22',
      description: 'USD report test',
      merchantName: 'USD Merchant',
      amount: -100,
    });
    const data = content(await callTool(userId, 'finance_monthly_stats', { month: '2026-09' }));
    expect(data.currencyCode).toBeNull();
    expect(data.currencyBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currencyCode: 'USD', expensesCents: 10_000 }),
        expect.objectContaining({ currencyCode: 'GBP', expensesCents: 25_000 }),
      ]),
    );
  });

  it('includes all rows when a month exceeds the analytics page size', async () => {
    for (let index = 0; index < 205; index += 1) {
      await insertTransaction({
        owner: userId,
        accountId: checkingId,
        postedOn: '2026-10-02',
        description: `Page-boundary transaction ${index}`,
        merchantName: 'Page Boundary',
        amount: -1,
      });
    }
    const data = content(await callTool(userId, 'finance_monthly_stats', { month: '2026-10' }));
    expect(data.transactionCount).toBe(205);
    expect(data.expensesCents).toBe(20_500);
  });

  it('returns currency breakdowns beyond the former result cap', async () => {
    for (let index = 0; index < 501; index += 1) {
      await insertTransaction({
        owner: userId,
        accountId: checkingId,
        postedOn: '2026-11-03',
        description: `Monthly currency ${index}`,
        merchantName: 'Currency Report',
        amount: -1,
        currencyCode: `Y${index.toString(36).toUpperCase().padStart(2, '0')}`,
      });
    }
    const data = content(await callTool(userId, 'finance_monthly_stats', { month: '2026-11' }));
    expect(data.currencyBreakdown).toHaveLength(500);
    expect(data.warnings).toContain('Currency breakdown truncated after 500 currencies.');
  });

  it('omits pending transactions from posted monthly activity', async () => {
    await insertTransaction({
      owner: userId,
      accountId: checkingId,
      postedOn: '2026-11-02',
      description: 'Pending report row',
      merchantName: 'Pending Merchant',
      amount: -900,
      pending: true,
    });
    const data = content(await callTool(userId, 'finance_monthly_stats', { month: '2026-11' }));
    expect(data).toMatchObject({ transactionCount: 0, expensesCents: 0 });
  });

  it('is empty for a month with no activity and for a different user', async () => {
    const empty = content(await callTool(userId, 'finance_monthly_stats', { month: '2025-01' }));
    expect(empty).toMatchObject({ incomeCents: 0, expensesCents: 0, transactionCount: 0 });

    const other = content(
      await callTool(otherUserId, 'finance_monthly_stats', { month: '2026-07' }),
    );
    expect(other).toMatchObject({ incomeCents: 0, expensesCents: 99_900, transactionCount: 1 });
  });

  it('omits the date range when the month defaults to the current month', async () => {
    const data = content(await callTool(userId, 'finance_monthly_stats', {}));
    expect(data.startDate).toBeUndefined();
    expect(data.endDate).toBeUndefined();
  });

  it('rejects a malformed month', async () => {
    await expect(callTool(userId, 'finance_monthly_stats', { month: 'July' })).rejects.toThrow();
  });

  it('rejects a month with no 13th calendar month', async () => {
    await expect(callTool(userId, 'finance_monthly_stats', { month: '2026-13' })).rejects.toThrow();
  });

  it('rejects unsupported parameters rather than ignoring them', async () => {
    await expect(
      callTool(userId, 'finance_monthly_stats', { month: '2026-07', period: '2026-09' }),
    ).rejects.toThrow();
  });
});

describe('finance_recent_transactions input validation', () => {
  it('rejects unsupported parameters', async () => {
    await expect(
      callTool(userId, 'finance_recent_transactions', { period: '2026-09' }),
    ).rejects.toThrow();
  });
});

describe('finance read tool input validation', () => {
  it('rejects unknown parameters across unbounded read schemas', async () => {
    const calls: Array<[string, Record<string, unknown>]> = [
      ['finance_net_worth', { unexpected: true }],
      ['finance_accounts', { unexpected: true }],
      ['finance_account_summary', { unexpected: true }],
      ['finance_top_merchants', { unexpected: true }],
      ['finance_tag_breakdown', { unexpected: true }],
      ['finance_runway', { unexpected: true }],
      ['finance_budget_breakdown', { monthlyIncomeCents: 100, unexpected: true }],
      ['finance_categories', { unexpected: true }],
    ];
    for (const [tool, input] of calls) {
      await expect(callTool(userId, tool, input)).rejects.toThrow();
    }
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
    const byTagId = content(
      await callTool(userId, 'finance_transaction_search', { tag: foodTagId }),
    );
    expect(byTagId.filteredCount).toBe(2);

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
    expect(firstPage.totalUserCount).toBe(6);
    expect(firstPage.count).toBe(2);
    const filtered = content(
      await callTool(userId, 'finance_transaction_search', { query: 'shell', limit: 1 }),
    );
    expect(filtered).toMatchObject({ filteredCount: 2, totalUserCount: 6 });
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

  it('rejects unsupported search parameters instead of silently ignoring them', async () => {
    await expect(
      callTool(userId, 'finance_transaction_search', { category: 'Uncategorized' }),
    ).rejects.toThrow();
  });
});

describe('finance_runway', () => {
  it('rejects unsupported fields inside monthly budget rows', async () => {
    await expect(
      callTool(userId, 'finance_runway', {
        monthlyBudgets: [{ category: 'Food', amountCents: 100, amuontCents: 200 }],
      }),
    ).rejects.toThrow();
  });

  it('projects from liquid accounts only', async () => {
    const data = content(
      await callTool(userId, 'finance_runway', {
        asOf: '2026-07-31',
        projectionWeeks: 4,
        monthlyBudgets: [{ category: 'Food', amountCents: 40_000, note: 'planned cap' }],
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

  it('accepts budget rows without notes and defaults the projection date', async () => {
    const data = content(
      await callTool(userId, 'finance_runway', {
        monthlyBudgets: [{ category: 'Food', amountCents: 1000 }],
        projectionWeeks: 1,
      }),
    );
    expect(data.weeks).toHaveLength(1);
    expect(data.asOfDate).toBeTruthy();
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
