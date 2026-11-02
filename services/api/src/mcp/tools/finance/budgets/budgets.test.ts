import { db, pool, sql } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';
import { FINANCE_TRANSACTION_ENTITY_TYPE } from '@hominem/finance-services';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { seedBudgetsOfRecord, getBudget } from '../../../../application/finance-budgets.service';
import { callTool, type McpToolResult } from '../../../tool-registry';
import '../register';

const userId = 'f2640000-0000-4000-8000-000000000001';
const otherUserId = 'f2640000-0000-4000-8000-000000000002';

const diningId = 'f2640001-0000-4000-8000-000000000001';
const travelId = 'f2640001-0000-4000-8000-000000000002';
const groceriesId = 'f2640001-0000-4000-8000-000000000003';
const otherDiningId = 'f2640001-0000-4000-8000-000000000004';

const accountId = 'f2640002-0000-4000-8000-000000000001';
const otherAccountId = 'f2640002-0000-4000-8000-000000000002';

type BudgetStatus = {
  id: string;
  categoryId: string;
  categoryName: string;
  tagId: string | null;
  tagName: string | null;
  amountCents: number;
  cadence: string;
  currencyCode: string;
  period: { startsOn: string; endsOn: string };
  openingBalanceCents: number;
  availableCents: number;
  spentCents: number;
  remainingCents: number;
  sweptToSavingsCents: number;
  breach: { categoryId: string; categoryName: string; overByCents: number } | null;
  tagBudgets: Array<{
    tagId: string;
    tagName: string;
    amountCents: number;
    cadence: string;
    amountInCategoryCadenceCents: number;
    spentCents: number;
    remainingCents: number;
    overTagBudget: boolean;
  }>;
  pace: {
    periodElapsedFraction: number;
    spentFraction: number | null;
    projectedSpendCents: number | null;
    projectedExhaustionDate: string | null;
    paceStatus: string;
  };
  uncountedForeignTransactionCount: number;
  uncountedForeignTransactions: Array<{
    id: string;
    postedOn: string;
    currencyCode: string;
    amountCents: number;
  }>;
};

type Content = {
  id?: string | null;
  budget?: BudgetStatus | null;
  budgets?: BudgetStatus[];
  breaches?: Array<{ categoryId: string; categoryName: string; overByCents: number }>;
  created?: boolean;
  reason?: string | null;
  removed?: boolean;
  primaryCurrency?: string;
  count?: number;
};

function content(result: McpToolResult<Content>): Content {
  return result.structuredContent ?? {};
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const now = new Date();
const currentMonthStart = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
const currentMonthEnd = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
const previousMonthDay = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)));
const nextMonthStart = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)));
const currentYearStart = iso(new Date(Date.UTC(now.getUTCFullYear(), 0, 1)));
const previousYearDay = iso(new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 31)));

let transactionCounter = 0;

async function insertTransaction(input: {
  accountId: string;
  categoryId: string;
  postedOn: string;
  amount: number;
  currencyCode?: string;
  settledAmount?: number;
  settledCurrencyCode?: string;
  excluded?: boolean;
  pending?: boolean;
  transactionType?: string;
}): Promise<string> {
  transactionCounter += 1;
  const id = `f2640003-0000-4000-8000-${String(transactionCounter).padStart(12, '0')}`;
  await db
    .insertInto('app.financeTransactions')
    .values({
      id,
      userId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      postedOn: input.postedOn,
      description: `budget-test-${transactionCounter}`,
      merchantName: `Merchant ${transactionCounter}`,
      amount: input.amount,
      currencyCode: input.currencyCode ?? 'GBP',
      settledAmount: input.settledAmount ?? null,
      settledCurrencyCode: input.settledCurrencyCode ?? null,
      transactionType: input.transactionType ?? (input.amount < 0 ? 'debit' : 'credit'),
      pending: input.pending ?? false,
      excluded: input.excluded ?? false,
      providerPayload: {},
      externalId: `budget-test-${transactionCounter}`,
    })
    .execute();
  return id;
}

/** A tag in the fixture's owner's taxonomy; `beforeEach` removes them between cases. */
async function insertTag(name: string): Promise<string> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const row = await db
    .insertInto('app.tags')
    .values({ ownerUserid: userId, name, slug, path: slug.replace(/-/g, '_') })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function tagTransaction(transactionId: string, tagId: string): Promise<void> {
  await db
    .insertInto('app.tagAssignments')
    .values({
      tagId,
      entityTable: sql<string>`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`,
      entityId: transactionId,
    })
    .execute();
}

async function insertBudgetAt(input: {
  categoryId: string;
  amountCents: number;
  cadence: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  createdAt: string;
}): Promise<string> {
  const row = await db
    .insertInto('app.financeBudgets')
    .values({
      userId,
      categoryId: input.categoryId,
      amountCents: input.amountCents,
      cadence: input.cadence,
      createdAt: input.createdAt,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function clearUserData(id: string) {
  await db.deleteFrom('app.financeBudgets').where('userId', '=', id).execute();
  await db.deleteFrom('app.userProfiles').where('userId', '=', id).execute();
  await db.deleteFrom('app.financeTransactions').where('userId', '=', id).execute();
  await db.deleteFrom('app.financeCategories').where('userId', '=', id).execute();
  await db.deleteFrom('app.financeAccounts').where('userId', '=', id).execute();
}

async function seedUser(id: string, name: string) {
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
    [id, name, `${id}@test.hominem.dev`, true],
  );
}

beforeAll(async () => {
  await seedUser(userId, 'Budget Test User');
  await seedUser(otherUserId, 'Budget Other User');

  for (const id of [userId, otherUserId]) {
    await clearUserData(id);
  }

  await db
    .insertInto('app.financeAccounts')
    .values([
      {
        id: accountId,
        userId,
        name: 'Budget Test Account',
        accountType: 'checking',
        currencyCode: 'GBP',
        allowedCurrencies: ['GBP', 'USD'],
        lifecycleStatus: 'open',
        metadata: {},
      },
      {
        id: otherAccountId,
        userId: otherUserId,
        name: 'Budget Other Account',
        accountType: 'checking',
        currencyCode: 'GBP',
        lifecycleStatus: 'open',
        metadata: {},
      },
    ])
    .execute();

  await db
    .insertInto('app.financeCategories')
    .values([
      { id: diningId, userId, name: 'Budget Cadence Dining' },
      { id: travelId, userId, name: 'Budget Cadence Travel' },
      { id: groceriesId, userId, name: 'Budget Cadence Groceries' },
      { id: otherDiningId, userId: otherUserId, name: 'Budget Other Dining' },
    ])
    .execute();
});

beforeEach(async () => {
  await db.deleteFrom('app.financeBudgets').where('userId', 'in', [userId, otherUserId]).execute();
  await db.deleteFrom('app.userProfiles').where('userId', 'in', [userId, otherUserId]).execute();
  await db
    .deleteFrom('app.financeTransactions')
    .where('userId', 'in', [userId, otherUserId])
    .execute();
  await db.deleteFrom('app.tags').where('ownerUserid', 'in', [userId, otherUserId]).execute();
  await callTool(userId, 'finance_primary_currency_set', { currencyCode: 'GBP' });
});

describe('finance_budget_create', () => {
  it('requires the profile primary currency before a budget can exist', async () => {
    await db.deleteFrom('app.userProfiles').where('userId', '=', userId).execute();

    await expect(
      callTool(userId, 'finance_budget_create', {
        categoryId: diningId,
        amountCents: 30_000,
        cadence: 'monthly',
      }),
    ).rejects.toThrow(/primary currency/i);

    const set = content(
      await callTool(userId, 'finance_primary_currency_set', { currencyCode: 'gbp' }),
    );
    expect(set.primaryCurrency).toBe('GBP');
  });

  it('keeps exactly one budget row per category when created twice', async () => {
    const first = content(
      await callTool(userId, 'finance_budget_create', {
        categoryId: diningId,
        amountCents: 30_000,
        cadence: 'monthly',
      }),
    );
    expect(first.created).toBe(true);
    expect(first.budget).toMatchObject({ amountCents: 30_000, cadence: 'monthly' });

    const second = content(
      await callTool(userId, 'finance_budget_create', {
        categoryId: diningId,
        amountCents: 35_000,
        cadence: 'quarterly',
      }),
    );
    expect(second.created).toBe(false);
    expect(second.budget?.id).toBe(first.budget?.id);
    expect(second.budget).toMatchObject({ amountCents: 35_000, cadence: 'quarterly' });

    const rows = await db
      .selectFrom('app.financeBudgets')
      .selectAll()
      .where('userId', '=', userId)
      .where('categoryId', '=', diningId)
      .execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.cadence).toBe('quarterly');
  });

  it('rejects a currency argument and a cadence outside the fixed set', async () => {
    await expect(
      callTool(userId, 'finance_budget_create', {
        categoryId: diningId,
        amountCents: 30_000,
        cadence: 'monthly',
        currencyCode: 'GBP',
      }),
    ).rejects.toThrow();

    await expect(
      callTool(userId, 'finance_budget_create', {
        categoryId: diningId,
        amountCents: 30_000,
        cadence: 'every_45_days',
      }),
    ).rejects.toThrow();
  });

  it('reports an unknown category instead of creating a budget', async () => {
    const result = content(
      await callTool(userId, 'finance_budget_create', {
        categoryId: otherDiningId,
        amountCents: 30_000,
        cadence: 'monthly',
      }),
    );
    expect(result.budget).toBeNull();
    expect(result.reason).toBe('unknown_category');
  });
});

describe('finance_budget status', () => {
  it('reports each budget against its own cadence’s calendar period', async () => {
    await callTool(userId, 'finance_budget_create', {
      categoryId: diningId,
      amountCents: 30_000,
      cadence: 'monthly',
    });
    await callTool(userId, 'finance_budget_create', {
      categoryId: travelId,
      amountCents: 400_000,
      cadence: 'annual',
    });

    await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: currentMonthStart,
      amount: -50,
    });
    // Last month's dining is outside the current monthly period.
    await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: previousMonthDay,
      amount: -90,
    });
    // Next month's dining is outside it too.
    await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: nextMonthStart,
      amount: -70,
    });
    // A January flight counts against the annual travel budget all year.
    await insertTransaction({
      accountId,
      categoryId: travelId,
      postedOn: currentYearStart,
      amount: -600,
    });
    await insertTransaction({
      accountId,
      categoryId: travelId,
      postedOn: currentYearStart,
      amount: -400,
    });
    // Last year's flight does not count against this year.
    await insertTransaction({
      accountId,
      categoryId: travelId,
      postedOn: previousYearDay,
      amount: -150,
    });

    const listed = content(await callTool(userId, 'finance_budget_list', {}));
    const dining = listed.budgets?.find((budget) => budget.categoryId === diningId);
    const travel = listed.budgets?.find((budget) => budget.categoryId === travelId);

    expect(dining?.period).toEqual({ startsOn: currentMonthStart, endsOn: currentMonthEnd });
    expect(dining?.spentCents).toBe(5_000);
    expect(dining?.remainingCents).toBe(25_000);

    expect(travel?.period).toEqual({
      startsOn: currentYearStart,
      endsOn: `${now.getUTCFullYear()}-12-31`,
    });
    expect(travel?.spentCents).toBe(100_000);
    expect(travel?.remainingCents).toBe(300_000);
    expect(listed.primaryCurrency).toBe('GBP');
  });

  it('counts primary-currency transactions at their own amount and foreign ones at their settled amount', async () => {
    await callTool(userId, 'finance_budget_create', {
      categoryId: diningId,
      amountCents: 30_000,
      cadence: 'monthly',
    });

    // £50.00 charged in GBP.
    await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: currentMonthStart,
      amount: -50,
    });
    // $40.00 charged as £31.20 — the settled amount is what counts.
    await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: currentMonthStart,
      amount: -40,
      currencyCode: 'USD',
      settledAmount: 31.2,
      settledCurrencyCode: 'GBP',
    });
    // $20.00 with no settled GBP amount cannot be counted.
    await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: currentMonthStart,
      amount: -20,
      currencyCode: 'USD',
    });
    // Excluded, pending and transfer rows never count as spending.
    await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: currentMonthStart,
      amount: -100,
      excluded: true,
    });
    await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: currentMonthStart,
      amount: -100,
      pending: true,
    });
    await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: currentMonthStart,
      amount: -100,
      transactionType: 'transfer',
    });

    const status = content(await callTool(userId, 'finance_budget_list', {})).budgets?.[0];
    expect(status?.spentCents).toBe(8_120);
    expect(status?.remainingCents).toBe(21_880);
    expect(status?.uncountedForeignTransactionCount).toBe(1);
    expect(status?.uncountedForeignTransactions).toHaveLength(1);
    expect(status?.uncountedForeignTransactions[0]).toMatchObject({
      currencyCode: 'USD',
      amountCents: 2_000,
    });
  });

  it('counts a foreign transaction recorded through the write tools at its settled amount', async () => {
    const category = await db
      .selectFrom('app.financeCategories')
      .select('name')
      .where('id', '=', diningId)
      .executeTakeFirstOrThrow();
    await callTool(userId, 'finance_budget_create', {
      categoryId: diningId,
      amountCents: 30_000,
      cadence: 'monthly',
    });

    const upserted = content(
      await callTool(userId, 'finance_transaction_upsert', {
        postedOn: currentMonthStart,
        account: accountId,
        description: 'Los Angeles dinner',
        amountCents: -4_000,
        currencyCode: 'USD',
        category: category.name,
        settledAmountCents: 3_120,
        settledCurrencyCode: 'GBP',
      }),
    );
    expect(upserted.id).toBeTruthy();

    const budget = content(await callTool(userId, 'finance_budget_list', {})).budgets?.find(
      (item) => item.categoryId === diningId,
    );
    expect(budget?.spentCents).toBe(3_120);
    expect(budget?.remainingCents).toBe(26_880);
    expect(budget?.uncountedForeignTransactionCount).toBe(0);
  });

  it('does not move a budget’s spent total for a transaction in another category', async () => {
    await callTool(userId, 'finance_budget_create', {
      categoryId: diningId,
      amountCents: 30_000,
      cadence: 'monthly',
    });
    await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: currentMonthStart,
      amount: -10,
    });
    await insertTransaction({
      accountId,
      categoryId: groceriesId,
      postedOn: currentMonthStart,
      amount: -100,
    });

    const budget = content(await callTool(userId, 'finance_budget_list', {})).budgets?.find(
      (item) => item.categoryId === diningId,
    );
    expect(budget?.spentCents).toBe(1_000);
  });

  it('reports the pace projection for every cadence', async () => {
    await callTool(userId, 'finance_budget_create', {
      categoryId: diningId,
      amountCents: 30_000,
      cadence: 'monthly',
    });
    await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: currentMonthStart,
      amount: -10,
    });

    const budget = content(await callTool(userId, 'finance_budget_list', {})).budgets?.[0];
    expect(budget?.pace.periodElapsedFraction).toBeGreaterThanOrEqual(0);
    expect(budget?.pace.periodElapsedFraction).toBeLessThanOrEqual(1);
    expect(['insufficient_data', 'on_track', 'ahead']).toContain(budget?.pace.paceStatus);
    expect(budget?.pace).toHaveProperty('projectedSpendCents');
    expect(budget?.pace).toHaveProperty('projectedExhaustionDate');
  });
});

describe('finance_budget_update / get / delete', () => {
  it('updates the amount and cadence in place, reads it back, and deletes it', async () => {
    const created = content(
      await callTool(userId, 'finance_budget_create', {
        categoryId: travelId,
        amountCents: 400_000,
        cadence: 'annual',
      }),
    ).budget;
    expect(created).toBeTruthy();
    const budgetId = created?.id ?? '';

    const updated = content(
      await callTool(userId, 'finance_budget_update', {
        budgetId,
        amountCents: 450_000,
        cadence: 'quarterly',
      }),
    ).budget;
    expect(updated).toMatchObject({ amountCents: 450_000, cadence: 'quarterly' });
    expect(updated?.period).toEqual({
      startsOn: iso(
        new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1)),
      ),
      endsOn: iso(
        new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3 + 3, 0)),
      ),
    });

    const read = content(await callTool(userId, 'finance_budget_get', { budgetId })).budget;
    expect(read).toMatchObject({ id: budgetId, amountCents: 450_000, cadence: 'quarterly' });

    const removed = content(await callTool(userId, 'finance_budget_delete', { budgetId }));
    expect(removed.removed).toBe(true);
    expect(content(await callTool(userId, 'finance_budget_get', { budgetId })).budget).toBeNull();

    const rows = await db
      .selectFrom('app.financeBudgets')
      .selectAll()
      .where('id', '=', budgetId)
      .execute();
    expect(rows).toHaveLength(0);
  });

  it('never reaches another user’s budget', async () => {
    const otherProfile = content(
      await callTool(otherUserId, 'finance_primary_currency_set', { currencyCode: 'GBP' }),
    );
    expect(otherProfile.primaryCurrency).toBe('GBP');
    const created = content(
      await callTool(otherUserId, 'finance_budget_create', {
        categoryId: otherDiningId,
        amountCents: 20_000,
        cadence: 'monthly',
      }),
    ).budget;
    const budgetId = created?.id ?? '';

    expect(content(await callTool(userId, 'finance_budget_get', { budgetId })).budget).toBeNull();
    expect(
      content(
        await callTool(userId, 'finance_budget_update', {
          budgetId,
          amountCents: 1_000,
        }),
      ).budget,
    ).toBeNull();
    expect(content(await callTool(userId, 'finance_budget_delete', { budgetId })).removed).toBe(
      false,
    );
  });
});

describe('rollover at read time', () => {
  it('carries a monthly overspend as a deficit into the next period', async () => {
    const budgetId = await insertBudgetAt({
      categoryId: diningId,
      amountCents: 30_000,
      cadence: 'monthly',
      createdAt: '2026-01-15T00:00:00.000Z',
    });
    await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: '2026-03-10',
      amount: -340,
    });

    const april = (await getBudget(userId, budgetId, new Date('2026-04-15T00:00:00.000Z'))).budget;
    expect(april).toMatchObject({
      period: { startsOn: '2026-04-01', endsOn: '2026-04-30' },
      openingBalanceCents: -4_000,
      availableCents: 26_000,
      spentCents: 0,
      remainingCents: 26_000,
    });
  });

  it('sweeps a monthly underspend to savings instead of carrying it', async () => {
    const budgetId = await insertBudgetAt({
      categoryId: diningId,
      amountCents: 30_000,
      cadence: 'monthly',
      createdAt: '2026-01-15T00:00:00.000Z',
    });
    await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: '2026-03-10',
      amount: -250,
    });

    const april = (await getBudget(userId, budgetId, new Date('2026-04-15T00:00:00.000Z'))).budget;
    expect(april).toMatchObject({
      openingBalanceCents: 0,
      availableCents: 30_000,
      sweptToSavingsCents: 5_000,
    });
  });

  it('carries an annual underspend and then an annual deficit', async () => {
    const budgetId = await insertBudgetAt({
      categoryId: travelId,
      amountCents: 400_000,
      cadence: 'annual',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await insertTransaction({
      accountId,
      categoryId: travelId,
      postedOn: '2026-03-01',
      amount: -1_000,
    });

    const secondYear = (await getBudget(userId, budgetId, new Date('2027-06-15T00:00:00.000Z')))
      .budget;
    expect(secondYear).toMatchObject({
      period: { startsOn: '2027-01-01', endsOn: '2027-12-31' },
      openingBalanceCents: 300_000,
      availableCents: 700_000,
      spentCents: 0,
    });

    await insertTransaction({
      accountId,
      categoryId: travelId,
      postedOn: '2027-03-01',
      amount: -7_500,
    });

    const thirdYear = (await getBudget(userId, budgetId, new Date('2028-06-15T00:00:00.000Z')))
      .budget;
    expect(thirdYear).toMatchObject({
      openingBalanceCents: -50_000,
      availableCents: 350_000,
    });
  });
});

describe('budgets of record', () => {
  it('seeds Groceries 25000 monthly and Dining Out 30000 monthly', async () => {
    await db.deleteFrom('app.financeBudgets').where('userId', '=', userId).execute();
    await seedBudgetsOfRecord(userId, 'GBP');

    const listed = content(await callTool(userId, 'finance_budget_list', {}));
    const groceries = listed.budgets?.find((budget) => budget.categoryName === 'Groceries');
    const dining = listed.budgets?.find((budget) => budget.categoryName === 'Dining Out');

    expect(groceries).toMatchObject({ amountCents: 25_000, cadence: 'monthly' });
    expect(dining).toMatchObject({ amountCents: 30_000, cadence: 'monthly' });
  });
});

describe('nested tag budgets', () => {
  it('lists only uncounted foreign transactions carrying that tag', async () => {
    const coffeeTagId = await insertTag('Coffee');
    const restaurantTagId = await insertTag('Restaurant');
    await callTool(userId, 'finance_budget_set', {
      categoryId: diningId,
      amountCents: 30_000,
      cadence: 'monthly',
      tagBudgets: [{ tagId: coffeeTagId, amountCents: 5_000, cadence: 'monthly' }],
    });
    const tagBudgetId = (
      await db
        .selectFrom('app.financeBudgets')
        .select('id')
        .where('userId', '=', userId)
        .where('categoryId', '=', diningId)
        .where('tagId', '=', coffeeTagId)
        .executeTakeFirstOrThrow()
    ).id;
    const coffeeSpendId = await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: currentMonthStart,
      amount: -20,
      currencyCode: 'USD',
    });
    const restaurantSpendId = await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: currentMonthStart,
      amount: -30,
      currencyCode: 'USD',
    });
    await tagTransaction(coffeeSpendId, coffeeTagId);
    await tagTransaction(restaurantSpendId, restaurantTagId);

    const tagBudget = content(
      await callTool(userId, 'finance_budget_get', { budgetId: tagBudgetId }),
    ).budget;
    expect(tagBudget?.uncountedForeignTransactionCount).toBe(1);
    expect(tagBudget?.uncountedForeignTransactions.map((transaction) => transaction.id)).toEqual([
      coffeeSpendId,
    ]);
  });

  it('deletes nested tag budgets together with their category budget', async () => {
    const coffeeTagId = await insertTag('Coffee');
    const saved = content(
      await callTool(userId, 'finance_budget_set', {
        categoryId: diningId,
        amountCents: 30_000,
        cadence: 'monthly',
        tagBudgets: [{ tagId: coffeeTagId, amountCents: 5_000, cadence: 'monthly' }],
      }),
    ).budget;

    expect(saved?.tagBudgets).toHaveLength(1);
    expect(
      content(await callTool(userId, 'finance_budget_delete', { budgetId: saved!.id })).removed,
    ).toBe(true);
    expect(
      await db
        .selectFrom('app.financeBudgets')
        .select('id')
        .where('userId', '=', userId)
        .where('categoryId', '=', diningId)
        .execute(),
    ).toEqual([]);
  });

  it('saves a category budget with tag budgets beneath it and reads them back intact', async () => {
    const coffeeTagId = await insertTag('Coffee');
    const restaurantTagId = await insertTag('Restaurant');

    const saved = content(
      await callTool(userId, 'finance_budget_set', {
        categoryId: diningId,
        amountCents: 30_000,
        cadence: 'monthly',
        tagBudgets: [
          { tagId: coffeeTagId, amountCents: 5_000, cadence: 'monthly' },
          { tagId: restaurantTagId, amountCents: 1_000, cadence: 'weekly' },
        ],
      }),
    ).budget;

    expect(saved).toMatchObject({ amountCents: 30_000, cadence: 'monthly', tagId: null });
    expect(saved?.tagBudgets).toHaveLength(2);
    expect(saved?.tagBudgets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tagId: coffeeTagId,
          tagName: 'Coffee',
          amountCents: 5_000,
          cadence: 'monthly',
          amountInCategoryCadenceCents: 5_000,
        }),
        expect.objectContaining({
          tagId: restaurantTagId,
          tagName: 'Restaurant',
          amountCents: 1_000,
          cadence: 'weekly',
          // Weekly converted to monthly: 1,000 * 52 / 12, rounded.
          amountInCategoryCadenceCents: 4_333,
        }),
      ]),
    );

    const readBack = content(
      await callTool(userId, 'finance_budget_get', { budgetId: saved?.id ?? '' }),
    ).budget;
    expect(readBack).toMatchObject({ amountCents: 30_000, cadence: 'monthly' });
    expect(readBack?.tagBudgets.map((tag) => [tag.tagName, tag.amountCents, tag.cadence])).toEqual([
      ['Coffee', 5_000, 'monthly'],
      ['Restaurant', 1_000, 'weekly'],
    ]);

    // Each tag budget is also readable on its own, with its own cadence.
    const tagBudgetRow = await db
      .selectFrom('app.financeBudgets')
      .select('id')
      .where('userId', '=', userId)
      .where('tagId', '=', restaurantTagId)
      .executeTakeFirstOrThrow();
    const tagBudget = content(
      await callTool(userId, 'finance_budget_get', { budgetId: tagBudgetRow.id }),
    ).budget;
    expect(tagBudget).toMatchObject({
      tagId: restaurantTagId,
      tagName: 'Restaurant',
      amountCents: 1_000,
      cadence: 'weekly',
      breach: null,
      tagBudgets: [],
    });
  });

  it('accepts a tag sum equal to the category budget and one below it', async () => {
    const coffeeTagId = await insertTag('Coffee');

    const equal = content(
      await callTool(userId, 'finance_budget_set', {
        categoryId: diningId,
        amountCents: 30_000,
        cadence: 'monthly',
        tagBudgets: [{ tagId: coffeeTagId, amountCents: 30_000, cadence: 'monthly' }],
      }),
    ).budget;
    expect(equal?.tagBudgets[0]?.amountCents).toBe(30_000);

    const below = content(
      await callTool(userId, 'finance_budget_set', {
        categoryId: diningId,
        amountCents: 30_000,
        cadence: 'monthly',
        tagBudgets: [{ tagId: coffeeTagId, amountCents: 29_999, cadence: 'monthly' }],
      }),
    ).budget;
    expect(below?.tagBudgets[0]?.amountCents).toBe(29_999);
  });

  it('rejects a tag sum one cent over the category budget in full and leaves stored budgets unchanged', async () => {
    const coffeeTagId = await insertTag('Coffee');

    await callTool(userId, 'finance_budget_set', {
      categoryId: diningId,
      amountCents: 30_000,
      cadence: 'monthly',
      tagBudgets: [{ tagId: coffeeTagId, amountCents: 5_000, cadence: 'monthly' }],
    });

    await expect(
      callTool(userId, 'finance_budget_set', {
        categoryId: diningId,
        amountCents: 30_000,
        cadence: 'monthly',
        tagBudgets: [{ tagId: coffeeTagId, amountCents: 30_001, cadence: 'monthly' }],
      }),
    ).rejects.toThrow(/over the category budget|exceeds the category budget/i);

    const listed = content(await callTool(userId, 'finance_budget_list', {}));
    const budget = listed.budgets?.find((item) => item.categoryId === diningId);
    expect(budget).toMatchObject({ amountCents: 30_000, cadence: 'monthly' });
    expect(budget?.tagBudgets).toHaveLength(1);
    expect(budget?.tagBudgets[0]).toMatchObject({ tagId: coffeeTagId, amountCents: 5_000 });
  });

  it('names the category, tag sum, category budget and overage when rejecting a save', async () => {
    const coffeeTagId = await insertTag('Coffee');

    const error = await callTool(userId, 'finance_budget_set', {
      categoryId: diningId,
      amountCents: 10_000,
      cadence: 'monthly',
      tagBudgets: [{ tagId: coffeeTagId, amountCents: 12_500, cadence: 'monthly' }],
    }).then(
      () => null,
      (caught: unknown) => {
        if (!(caught instanceof ValidationError)) throw caught;
        return caught;
      },
    );

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain('Budget Cadence Dining');
    expect(error?.message).toContain('12500');
    expect(error?.message).toContain('10000');
    expect(error?.message).toContain('2500');
    expect(error?.details).toMatchObject({
      categoryName: 'Budget Cadence Dining',
      tagBudgetSumCents: 12_500,
      categoryBudgetCents: 10_000,
      overageCents: 2_500,
    });
  });

  it('never lets a tag budget exist without the category budget it sits inside', async () => {
    const coffeeTagId = await insertTag('Coffee');

    await expect(
      callTool(userId, 'finance_budget_create', {
        categoryId: diningId,
        tagId: coffeeTagId,
        amountCents: 5_000,
        cadence: 'monthly',
      }),
    ).rejects.toThrow(/no category budget/i);

    const rows = await db
      .selectFrom('app.financeBudgets')
      .selectAll()
      .where('userId', '=', userId)
      .where('categoryId', '=', diningId)
      .execute();
    expect(rows).toHaveLength(0);
  });

  it('reports a tag over its budget as composition only while the category is within budget', async () => {
    const coffeeTagId = await insertTag('Coffee');
    const restaurantTagId = await insertTag('Restaurant');
    await callTool(userId, 'finance_budget_set', {
      categoryId: diningId,
      amountCents: 30_000,
      cadence: 'monthly',
      tagBudgets: [
        { tagId: coffeeTagId, amountCents: 2_000, cadence: 'monthly' },
        { tagId: restaurantTagId, amountCents: 10_000, cadence: 'monthly' },
      ],
    });

    const coffeeSpend = await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: currentMonthStart,
      amount: -25,
    });
    await tagTransaction(coffeeSpend, coffeeTagId);

    const listed = content(await callTool(userId, 'finance_budget_list', {}));
    const budget = listed.budgets?.find((item) => item.categoryId === diningId);
    const coffee = budget?.tagBudgets.find((tag) => tag.tagId === coffeeTagId);

    expect(budget?.spentCents).toBe(2_500);
    expect(budget?.remainingCents).toBe(27_500);
    expect(budget?.breach).toBeNull();
    expect(listed.breaches).toEqual([]);
    expect(coffee).toMatchObject({
      amountCents: 2_000,
      spentCents: 2_500,
      remainingCents: -500,
      overTagBudget: true,
    });
  });

  it('reports a breach when the category is over budget, however spend distributes across tags', async () => {
    const coffeeTagId = await insertTag('Coffee');
    const restaurantTagId = await insertTag('Restaurant');
    await callTool(userId, 'finance_budget_set', {
      categoryId: diningId,
      amountCents: 30_000,
      cadence: 'monthly',
      tagBudgets: [
        { tagId: coffeeTagId, amountCents: 2_000, cadence: 'monthly' },
        { tagId: restaurantTagId, amountCents: 28_000, cadence: 'monthly' },
      ],
    });

    // The overspend is untagged, so no tag is over its own budget and the category still breaches.
    await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: currentMonthStart,
      amount: -350,
    });

    const listed = content(await callTool(userId, 'finance_budget_list', {}));
    const budget = listed.budgets?.find((item) => item.categoryId === diningId);
    expect(budget?.spentCents).toBe(35_000);
    expect(budget?.breach).toEqual({
      categoryId: diningId,
      categoryName: 'Budget Cadence Dining',
      overByCents: 5_000,
    });
    expect(listed.breaches).toEqual([budget?.breach]);
    expect(budget?.tagBudgets.every((tag) => !tag.overTagBudget)).toBe(true);

    // Redistribute the same spend onto the small tag: still exactly one breach, the category's.
    await db
      .deleteFrom('app.financeTransactions')
      .where('userId', '=', userId)
      .where('categoryId', '=', diningId)
      .execute();
    const coffeeSpend = await insertTransaction({
      accountId,
      categoryId: diningId,
      postedOn: currentMonthStart,
      amount: -350,
    });
    await tagTransaction(coffeeSpend, coffeeTagId);

    const redistributed = content(await callTool(userId, 'finance_budget_list', {}));
    const after = redistributed.budgets?.find((item) => item.categoryId === diningId);
    expect(after?.breach?.overByCents).toBe(5_000);
    expect(redistributed.breaches).toHaveLength(1);
    expect(after?.tagBudgets.find((tag) => tag.tagId === coffeeTagId)?.overTagBudget).toBe(true);
  });
});
