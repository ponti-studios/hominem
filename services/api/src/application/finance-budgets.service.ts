import { db } from '@hominem/db/core';
import { NotFoundError, ValidationError } from '@hominem/db/errors';
import {
  FinanceBudgetRepository,
  type FinanceBudgetCadence,
  type FinanceBudgetRecord,
  type UncountedForeignTransaction,
} from '@hominem/db/finance';

import {
  computePace,
  computeRollover,
  periodContaining,
  periodFor,
  type BudgetPace,
  type BudgetPeriod,
} from './finance-budget-periods';

/** The two budgets of record, seeded as the first budget rows. */
export const BUDGETS_OF_RECORD = [
  { categoryName: 'Groceries', amountCents: 25_000, cadence: 'monthly' },
  { categoryName: 'Dining Out', amountCents: 30_000, cadence: 'monthly' },
] as const satisfies ReadonlyArray<{
  categoryName: string;
  amountCents: number;
  cadence: FinanceBudgetCadence;
}>;

export type BudgetStatus = {
  id: string;
  categoryId: string;
  categoryName: string;
  amountCents: number;
  cadence: FinanceBudgetCadence;
  currencyCode: string;
  period: BudgetPeriod;
  openingBalanceCents: number;
  availableCents: number;
  spentCents: number;
  remainingCents: number;
  sweptToSavingsCents: number;
  pace: BudgetPace;
  uncountedForeignTransactionCount: number;
  uncountedForeignTransactions: UncountedForeignTransaction[];
  createdAt: string;
  updatedAt: string;
};

const DAY_MS = 86_400_000;

function addDaysIso(value: string, days: number): string {
  return new Date(new Date(`${value}T00:00:00.000Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The window the current period's spend is counted over: the calendar period, capped at today
 * so a future-dated row inside the period cannot count as already spent.
 */
function currentSpendWindow(period: BudgetPeriod, now: Date): { from: string; to: string } {
  const today = todayIso(now);
  const lastDay = period.endsOn < today ? period.endsOn : today;
  return { from: period.startsOn, to: addDaysIso(lastDay, 1) };
}

async function requirePrimaryCurrency(ownerUserId: string): Promise<string> {
  const currency = await FinanceBudgetRepository.getPrimaryCurrency(db, ownerUserId);
  if (!currency) {
    throw new ValidationError(
      'Set your primary currency with finance_primary_currency_set before using budgets.',
    );
  }
  return currency;
}

async function toStatus(
  budget: FinanceBudgetRecord,
  primaryCurrency: string,
  now: Date,
): Promise<BudgetStatus> {
  const currentPeriod = periodFor(budget.cadence, now);
  const trackingStart = periodContaining(budget.cadence, budget.createdAt);
  const window = currentSpendWindow(currentPeriod, now);

  const currentSpend = await FinanceBudgetRepository.getSpentTotal(db, budget.userId, {
    categoryId: budget.categoryId,
    primaryCurrency,
    from: window.from,
    to: window.to,
  });

  const spendByClosedPeriod = await FinanceBudgetRepository.getSpendByPeriod(db, budget.userId, {
    categoryId: budget.categoryId,
    primaryCurrency,
    cadence: budget.cadence,
    from: trackingStart.startsOn,
    to: currentPeriod.startsOn,
  });

  const { openingBalanceCents: openingBalance, sweptToSavingsCents: sweptToSavings } =
    computeRollover({
      cadence: budget.cadence,
      amountCents: budget.amountCents,
      trackingStartsOn: trackingStart.startsOn,
      currentPeriod,
      spentByPeriodStartsOn: spendByClosedPeriod,
    });
  const availableCents = budget.amountCents + openingBalance;
  const uncountedForeignTransactions =
    currentSpend.uncountedForeignTransactionCount > 0
      ? await FinanceBudgetRepository.listUncountedForeignTransactions(db, budget.userId, {
          categoryId: budget.categoryId,
          primaryCurrency,
          from: window.from,
          to: window.to,
        })
      : [];

  return {
    id: budget.id,
    categoryId: budget.categoryId,
    categoryName: budget.categoryName,
    amountCents: budget.amountCents,
    cadence: budget.cadence,
    currencyCode: primaryCurrency,
    period: currentPeriod,
    openingBalanceCents: openingBalance,
    availableCents,
    spentCents: currentSpend.spentCents,
    remainingCents: availableCents - currentSpend.spentCents,
    sweptToSavingsCents: sweptToSavings,
    pace: computePace({
      period: currentPeriod,
      now,
      spentCents: currentSpend.spentCents,
      availableCents,
    }),
    uncountedForeignTransactionCount: currentSpend.uncountedForeignTransactionCount,
    uncountedForeignTransactions,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
  };
}

export async function listBudgets(ownerUserId: string) {
  const primaryCurrency = await requirePrimaryCurrency(ownerUserId);
  const now = new Date();
  const budgets = await FinanceBudgetRepository.list(db, ownerUserId);
  return {
    primaryCurrency,
    budgets: await Promise.all(budgets.map((budget) => toStatus(budget, primaryCurrency, now))),
    count: budgets.length,
  };
}

export async function getBudget(ownerUserId: string, budgetId: string, now: Date = new Date()) {
  const primaryCurrency = await requirePrimaryCurrency(ownerUserId);
  const budget = await FinanceBudgetRepository.get(db, ownerUserId, budgetId);
  return { budget: budget ? await toStatus(budget, primaryCurrency, now) : null };
}

export async function createBudget(
  ownerUserId: string,
  input: { categoryId: string; amountCents: number; cadence: FinanceBudgetCadence },
) {
  const primaryCurrency = await requirePrimaryCurrency(ownerUserId);
  try {
    const { budget, created } = await FinanceBudgetRepository.create(db, ownerUserId, input);
    return {
      budget: await toStatus(budget, primaryCurrency, new Date()),
      created,
      reason: null,
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { budget: null, created: false, reason: 'unknown_category' as const };
    }
    throw error;
  }
}

export async function updateBudget(
  ownerUserId: string,
  budgetId: string,
  patch: { amountCents?: number; cadence?: FinanceBudgetCadence },
) {
  const primaryCurrency = await requirePrimaryCurrency(ownerUserId);
  const budget = await FinanceBudgetRepository.update(db, ownerUserId, budgetId, patch);
  return { budget: budget ? await toStatus(budget, primaryCurrency, new Date()) : null };
}

export async function deleteBudget(ownerUserId: string, budgetId: string) {
  return { removed: await FinanceBudgetRepository.remove(db, ownerUserId, budgetId) };
}

/** Preview data for the delete confirmation: no currency or spend needed to show what goes. */
export async function getBudgetPreview(ownerUserId: string, budgetId: string) {
  const budget = await FinanceBudgetRepository.get(db, ownerUserId, budgetId);
  return budget
    ? {
        categoryName: budget.categoryName,
        amountCents: budget.amountCents,
        cadence: budget.cadence,
      }
    : null;
}

export async function setPrimaryCurrency(ownerUserId: string, currencyCode: string) {
  const primaryCurrency = await FinanceBudgetRepository.setPrimaryCurrency(
    db,
    ownerUserId,
    currencyCode.toUpperCase(),
  );
  return { primaryCurrency };
}

/** Seeds Groceries £250/month and Dining Out £300/month as the first budget rows. */
export async function seedBudgetsOfRecord(ownerUserId: string, primaryCurrency = 'GBP') {
  await FinanceBudgetRepository.setPrimaryCurrency(db, ownerUserId, primaryCurrency.toUpperCase());
  const seeded: Array<{ categoryName: string; amountCents: number; cadence: string }> = [];
  for (const seed of BUDGETS_OF_RECORD) {
    const category = await FinanceBudgetRepository.findOrCreateCategory(
      db,
      ownerUserId,
      seed.categoryName,
    );
    await createBudget(ownerUserId, {
      categoryId: category.id,
      amountCents: seed.amountCents,
      cadence: seed.cadence,
    });
    seeded.push(seed);
  }
  return { primaryCurrency: primaryCurrency.toUpperCase(), seeded };
}
