import { db } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';
import { sql } from 'kysely';

import { toNumber } from './utils';

const WEEKS_PER_MONTH = 365.25 / 12 / 7;
const DAYS_PER_MONTH = 30.4375;

// 'depository' is Plaid's umbrella for checking/savings-like accounts and is
// also the type the Copilot import assigns every newly created account, so
// leaving it out zeroes the projection for exactly the import-flow users.
const DEFAULT_LIQUID_TYPES = ['cash', 'checking', 'savings', 'depository'];
const DEFAULT_LOOKBACK_MONTHS = 3;
const DEFAULT_PROJECTION_WEEKS = 16;

export interface RunwayBudget {
  category: string;
  amount: number;
  currencyCode?: string;
  note?: string;
}

export interface ComputeLedgerRunwayInput {
  userId: string;
  monthlyBudgets: RunwayBudget[];
  currencyCode?: string | null;
  liquidAccountTypes?: string[];
  recurringLookbackMonths?: number;
  projectionWeeks?: number;
  asOf?: string;
}

export interface RunwayWeek {
  week: number;
  weekStart: string;
  weekEnd: string;
  beginningCash: number;
  recurringOutflows: number;
  variableAllowance: number;
  netChange: number;
  endingCash: number;
}

export interface LedgerRunway {
  asOfDate: string;
  liquidAccounts: Array<{ accountName: string; balance: number }>;
  startingCash: number;
  weeklyRecurringOutflow: number;
  recurringLookbackMonths: number;
  recurringTxnCount: number;
  weeklyVariableAllowance: number;
  monthlyBudgets: RunwayBudget[];
  weeks: RunwayWeek[];
  currencyCode: string | null;
  warnings: string[];
}

export async function getRunwaySettings(userId: string) {
  const [preference, currencies, budgets, categories] = await Promise.all([
    db
      .selectFrom('app.financeRunwayPreferences')
      .select('currencyCode')
      .where('userId', '=', userId)
      .executeTakeFirst(),
    db
      .selectFrom('app.financeAccounts')
      .select(['currencyCode', 'allowedCurrencies'])
      .where('userId', '=', userId)
      .where('accountType', 'in', DEFAULT_LIQUID_TYPES)
      .orderBy('currencyCode')
      .execute(),
    db
      .selectFrom('app.financeMonthlyBudgets as budget')
      .innerJoin('app.financeCategories as category', 'category.id', 'budget.categoryId')
      .select([
        'budget.id',
        'budget.categoryId',
        'budget.currencyCode',
        'budget.monthlyAmount',
        'category.name',
      ])
      .where('budget.userId', '=', userId)
      .where('category.userId', '=', userId)
      .orderBy('category.name')
      .execute(),
    db
      .selectFrom('app.financeCategories')
      .select(['id', 'name'])
      .where('userId', '=', userId)
      .orderBy('name')
      .execute(),
  ]);
  return {
    currencyCode: preference?.currencyCode ?? null,
    currencies: [
      ...new Set(
        currencies.flatMap(({ currencyCode, allowedCurrencies }) => [
          currencyCode,
          ...(allowedCurrencies ?? []),
        ]),
      ),
    ].sort(),
    categories,
    budgets: budgets.map((budget) => ({
      id: budget.id,
      categoryId: budget.categoryId,
      category: budget.name,
      currencyCode: budget.currencyCode,
      amount: toNumber(budget.monthlyAmount),
    })),
  };
}

export async function saveRunwayCurrency(userId: string, currencyCode: string) {
  const accounts = await db
    .selectFrom('app.financeAccounts')
    .select(['currencyCode', 'allowedCurrencies'])
    .where('userId', '=', userId)
    .where('accountType', 'in', DEFAULT_LIQUID_TYPES)
    .execute();
  const isAvailable = accounts.some(
    (account) =>
      account.currencyCode === currencyCode ||
      (account.allowedCurrencies ?? []).includes(currencyCode),
  );
  if (!isAvailable) throw new ValidationError('Choose a currency available in a liquid account.');
  await db
    .insertInto('app.financeRunwayPreferences')
    .values({ userId, currencyCode })
    .onConflict((conflict) =>
      conflict.column('userId').doUpdateSet({ currencyCode, updatedAt: new Date().toISOString() }),
    )
    .execute();
}

export async function saveRunwayBudget(input: {
  userId: string;
  categoryId: string;
  currencyCode: string;
  amount: number;
}) {
  const category = await db
    .selectFrom('app.financeCategories')
    .select('id')
    .where('id', '=', input.categoryId)
    .where('userId', '=', input.userId)
    .executeTakeFirst();
  if (!category) throw new ValidationError('Category not found.');
  await db
    .insertInto('app.financeMonthlyBudgets')
    .values({
      userId: input.userId,
      categoryId: input.categoryId,
      currencyCode: input.currencyCode,
      monthlyAmount: input.amount,
    })
    .onConflict((conflict) =>
      conflict
        .columns(['userId', 'categoryId', 'currencyCode'])
        .doUpdateSet({ monthlyAmount: input.amount, updatedAt: new Date().toISOString() }),
    )
    .execute();
}

export async function removeRunwayBudget(userId: string, budgetId: string) {
  await db
    .deleteFrom('app.financeMonthlyBudgets')
    .where('id', '=', budgetId)
    .where('userId', '=', userId)
    .execute();
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function checkedDate(value: string | undefined): string {
  const date = value ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError('asOf must use YYYY-MM-DD format.');
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new ValidationError('asOf must use YYYY-MM-DD format.');
  }
  return date;
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/**
 * Week-by-week cash-flow projection computed live from the ledger — the pfin
 * `runway` port. Three inputs: starting cash is the ledger sum over liquid
 * account types (excluded rows ignored, pending rows included — the
 * `account_summary` semantics, not the pending-filtered service balances);
 * recurring outflow is the trailing average of `recurring`-flagged debits
 * (adjustments never count); the variable allowance is the configured
 * monthly category caps converted to a flat weekly figure. Nothing is
 * stored; every call derives from current data.
 */
export async function computeLedgerRunway(input: ComputeLedgerRunwayInput): Promise<LedgerRunway> {
  const asOfDate = checkedDate(input.asOf);
  const liquidTypes = input.liquidAccountTypes ?? DEFAULT_LIQUID_TYPES;
  const lookbackMonths = input.recurringLookbackMonths ?? DEFAULT_LOOKBACK_MONTHS;
  const projectionWeeks = input.projectionWeeks ?? DEFAULT_PROJECTION_WEEKS;

  if (!Number.isFinite(lookbackMonths) || lookbackMonths <= 0) {
    throw new ValidationError('recurringLookbackMonths must be a positive number.');
  }
  if (!Number.isInteger(projectionWeeks) || projectionWeeks <= 0) {
    throw new ValidationError('projectionWeeks must be a positive integer.');
  }
  for (const budget of input.monthlyBudgets) {
    if (!Number.isFinite(budget.amount) || budget.amount < 0) {
      throw new ValidationError('Monthly budget amounts must be finite and non-negative.');
    }
  }

  const accountRows = await db
    .selectFrom('app.financeAccounts')
    .select(['id', 'name', 'currencyCode', 'allowedCurrencies'])
    .where('userId', '=', input.userId)
    .where('accountType', 'in', liquidTypes)
    .orderBy('name', 'asc')
    .execute();

  // Summing balances across currencies would produce a meaningless total. Use the
  // explicitly selected currency and disclose all other available currencies.
  const distinctCurrencies = [
    ...new Set(
      accountRows.flatMap(({ currencyCode, allowedCurrencies }) => [
        currencyCode,
        ...(allowedCurrencies ?? []),
      ]),
    ),
  ];
  const warnings: string[] = [];
  const currencyCode = input.currencyCode ?? null;
  const selectedAccounts = currencyCode
    ? accountRows.filter(
        (account) =>
          account.currencyCode === currencyCode ||
          (account.allowedCurrencies ?? []).includes(currencyCode),
      )
    : [];
  const selectedIds = selectedAccounts.map((account) => account.id);
  const balanceRows = selectedIds.length
    ? await db
        .selectFrom('app.financeTransactions')
        .select((eb) => ['accountId', eb.fn.sum<number>('amount').as('balance')])
        .where('userId', '=', input.userId)
        .where('currencyCode', '=', currencyCode!)
        .where('accountId', 'in', selectedIds)
        .where('excluded', '=', false)
        .groupBy('accountId')
        .execute()
    : [];
  const balanceByAccountId = new Map(
    balanceRows.map(({ accountId, balance }) => [accountId, toNumber(balance)]),
  );
  const liquidAccounts = selectedAccounts.map((account) => ({
    accountName: account.name,
    balance: roundMoney(balanceByAccountId.get(account.id) ?? 0),
  }));
  if (distinctCurrencies.length > 0 && !currencyCode) {
    warnings.push('Choose a forecast currency to include matching-currency balances and activity.');
  } else if (currencyCode) {
    if (!distinctCurrencies.includes(currencyCode)) {
      warnings.push(
        `No liquid accounts are available in ${currencyCode}; other currencies are excluded.`,
      );
    }
    const excludedCurrencies = distinctCurrencies.filter((value) => value !== currencyCode);
    if (excludedCurrencies.length > 0) {
      warnings.push(
        `Only ${currencyCode} is included. Other currencies excluded: ${excludedCurrencies.join(', ')}.`,
      );
    }
  }

  const startingCash = roundMoney(liquidAccounts.reduce((sum, entry) => sum + entry.balance, 0));

  const lookbackStart = addDays(asOfDate, -Math.round(lookbackMonths * DAYS_PER_MONTH));
  const recurringRow = await db
    .selectFrom('app.financeTransactions')
    .select((eb) => [eb.fn.countAll<number>().as('count'), eb.fn.sum<number>('amount').as('total')])
    .where('userId', '=', input.userId)
    .where('currencyCode', '=', currencyCode ?? '')
    .where('excluded', '=', false)
    .where('transactionType', '!=', 'adjustment')
    .where(sql<boolean>`amount < 0`)
    .where('recurring', '=', true)
    .where('postedOn', '>=', lookbackStart)
    .where('postedOn', '<=', asOfDate)
    .executeTakeFirst();
  const recurringTxnCount = Number(recurringRow?.count ?? 0);
  const weeklyRecurringOutflow = roundMoney(
    Math.abs(toNumber(recurringRow?.total ?? 0)) / (lookbackMonths * WEEKS_PER_MONTH),
  );

  const weeklyVariableAllowance = roundMoney(
    input.monthlyBudgets
      .filter((budget) => budget.currencyCode === currencyCode)
      .reduce((sum, budget) => sum + budget.amount, 0) / WEEKS_PER_MONTH,
  );

  const weeks: RunwayWeek[] = [];
  let beginningCash = startingCash;
  let weekStart = asOfDate;
  for (let week = 1; week <= projectionWeeks; week++) {
    const weekEnd = addDays(weekStart, 6);
    const netChange = roundMoney(-(weeklyRecurringOutflow + weeklyVariableAllowance));
    const endingCash = roundMoney(beginningCash + netChange);
    weeks.push({
      week,
      weekStart,
      weekEnd,
      beginningCash: roundMoney(beginningCash),
      recurringOutflows: weeklyRecurringOutflow,
      variableAllowance: weeklyVariableAllowance,
      netChange,
      endingCash,
    });
    beginningCash = endingCash;
    weekStart = addDays(weekEnd, 1);
  }

  return {
    asOfDate,
    liquidAccounts: liquidAccounts.map((a) => ({ accountName: a.accountName, balance: a.balance })),
    startingCash,
    weeklyRecurringOutflow,
    recurringLookbackMonths: lookbackMonths,
    recurringTxnCount,
    weeklyVariableAllowance,
    monthlyBudgets: input.monthlyBudgets,
    weeks,
    currencyCode,
    warnings,
  };
}
