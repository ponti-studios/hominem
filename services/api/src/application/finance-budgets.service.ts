import { db, runInTransaction, type DbHandle } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';
import {
  FinanceBudgetRepository,
  type FinanceBudgetCadence,
  type FinanceBudgetRecord,
  type UncountedForeignTransaction,
} from '@hominem/db/finance';

import { validateNestedBudgets } from './finance-budget-nesting';
import {
  evaluateCategoryBudgetPacing,
  type BudgetBreach,
  type TagBudgetComposition,
} from './finance-budget-pacing';
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
  /** Null on a category budget; set on a tag budget nested inside that category. */
  tagId: string | null;
  tagName: string | null;
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
  /** Set only on a category budget that is over it. A tag budget never breaches. */
  breach: BudgetBreach | null;
  /** A category budget's tag budgets, as composition. Always empty on a tag budget. */
  tagBudgets: TagBudgetComposition[];
  uncountedForeignTransactionCount: number;
  uncountedForeignTransactions: UncountedForeignTransaction[];
  createdAt: string;
  updatedAt: string;
};

export type BudgetWriteInput = {
  categoryId: string;
  amountCents: number;
  cadence: FinanceBudgetCadence;
  /** Set to create or replace the budget for that tag inside the category. */
  tagId?: string | null;
};

export type TagBudgetWriteInput = {
  tagId: string;
  amountCents: number;
  cadence: FinanceBudgetCadence;
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

/**
 * A category's tag budgets and what each has spent in its own current period. Tag spend never
 * folds rollover: a tag budget is composition tracking, not a carried balance.
 */
async function readTagComposition(
  budget: FinanceBudgetRecord,
  primaryCurrency: string,
  now: Date,
): Promise<
  Array<{
    tagId: string;
    tagName: string;
    amountCents: number;
    cadence: FinanceBudgetCadence;
    spentCents: number;
  }>
> {
  const budgets = await FinanceBudgetRepository.listByCategory(
    db,
    budget.userId,
    budget.categoryId,
  );
  return Promise.all(
    budgets
      .filter(
        (candidate): candidate is FinanceBudgetRecord & { tagId: string; tagName: string } =>
          candidate.tagId !== null && candidate.tagName !== null,
      )
      .map(async (tag) => {
        const window = currentSpendWindow(periodFor(tag.cadence, now), now);
        const spend = await FinanceBudgetRepository.getSpentTotal(db, tag.userId, {
          categoryId: tag.categoryId,
          primaryCurrency,
          from: window.from,
          to: window.to,
          tagId: tag.tagId,
        });
        return {
          tagId: tag.tagId,
          tagName: tag.tagName,
          amountCents: tag.amountCents,
          cadence: tag.cadence,
          spentCents: spend.spentCents,
        };
      }),
  );
}

async function toStatus(
  budget: FinanceBudgetRecord,
  primaryCurrency: string,
  now: Date,
): Promise<BudgetStatus> {
  const currentPeriod = periodFor(budget.cadence, now);
  const trackingStart = periodContaining(budget.cadence, budget.createdAt);
  const window = currentSpendWindow(currentPeriod, now);
  const isTagBudget = budget.tagId !== null;

  const currentSpend = await FinanceBudgetRepository.getSpentTotal(db, budget.userId, {
    categoryId: budget.categoryId,
    primaryCurrency,
    from: window.from,
    to: window.to,
    ...(budget.tagId ? { tagId: budget.tagId } : {}),
  });

  // A tag budget is composition: its period starts fresh and no surplus or deficit carries.
  const spendByClosedPeriod = isTagBudget
    ? new Map<string, number>()
    : await FinanceBudgetRepository.getSpendByPeriod(db, budget.userId, {
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
          ...(budget.tagId ? { tagId: budget.tagId } : {}),
        })
      : [];

  const pacing = isTagBudget
    ? null
    : evaluateCategoryBudgetPacing({
        categoryId: budget.categoryId,
        categoryName: budget.categoryName,
        categoryCadence: budget.cadence,
        availableCents,
        spentCents: currentSpend.spentCents,
        tagBudgets: await readTagComposition(budget, primaryCurrency, now),
      });

  return {
    id: budget.id,
    categoryId: budget.categoryId,
    categoryName: budget.categoryName,
    tagId: budget.tagId,
    tagName: budget.tagName,
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
    breach: pacing?.breach ?? null,
    tagBudgets: pacing?.composition ?? [],
    uncountedForeignTransactionCount: currentSpend.uncountedForeignTransactionCount,
    uncountedForeignTransactions,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
  };
}

/**
 * Reads back what is stored for the category and enforces the nested-budget invariant on it.
 * Called inside the write's transaction after the write, so a rejection rolls the whole save
 * back and the previously stored budgets stay untouched.
 */
async function assertNestedBudgets(
  handle: DbHandle,
  ownerUserId: string,
  categoryId: string,
  categoryName: string,
): Promise<void> {
  const rows = await FinanceBudgetRepository.listByCategory(handle, ownerUserId, categoryId);
  const categoryBudget = rows.find((row) => row.tagId === null);
  const tagBudgets = rows.filter((row) => row.tagId !== null);
  if (!categoryBudget) {
    if (tagBudgets.length === 0) return;
    throw new ValidationError(
      `Tag budgets need the category budget they sit inside: "${categoryName}" has no category budget. Save the category budget first; nothing was saved.`,
      { categoryName, tagBudgetCount: tagBudgets.length },
    );
  }
  validateNestedBudgets({
    categoryName,
    categoryBudgetCents: categoryBudget.amountCents,
    categoryCadence: categoryBudget.cadence,
    tagBudgets,
  });
}

export async function listBudgets(ownerUserId: string) {
  const primaryCurrency = await requirePrimaryCurrency(ownerUserId);
  const now = new Date();
  const budgets = await FinanceBudgetRepository.list(db, ownerUserId);
  const statuses = await Promise.all(
    budgets.map((budget) => toStatus(budget, primaryCurrency, now)),
  );
  return {
    primaryCurrency,
    budgets: statuses,
    breaches: statuses.flatMap((status) => (status.breach ? [status.breach] : [])),
    count: statuses.length,
  };
}

export async function getBudget(ownerUserId: string, budgetId: string, now: Date = new Date()) {
  const primaryCurrency = await requirePrimaryCurrency(ownerUserId);
  const budget = await FinanceBudgetRepository.get(db, ownerUserId, budgetId);
  return { budget: budget ? await toStatus(budget, primaryCurrency, now) : null };
}

export async function createBudget(ownerUserId: string, input: BudgetWriteInput) {
  const primaryCurrency = await requirePrimaryCurrency(ownerUserId);
  const saved = await runInTransaction(async (trx) => {
    const category = await FinanceBudgetRepository.lockCategory(trx, ownerUserId, input.categoryId);
    if (!category) return null;
    const result = await FinanceBudgetRepository.create(trx, ownerUserId, input);
    await assertNestedBudgets(trx, ownerUserId, input.categoryId, category.name);
    return result;
  });
  if (!saved) return { budget: null, created: false, reason: 'unknown_category' as const };
  return {
    budget: await toStatus(saved.budget, primaryCurrency, new Date()),
    created: saved.created,
    reason: null,
  };
}

export async function updateBudget(
  ownerUserId: string,
  budgetId: string,
  patch: { amountCents?: number; cadence?: FinanceBudgetCadence },
) {
  const primaryCurrency = await requirePrimaryCurrency(ownerUserId);
  const saved = await runInTransaction(async (trx) => {
    const existing = await FinanceBudgetRepository.get(trx, ownerUserId, budgetId);
    if (!existing) return null;
    const category = await FinanceBudgetRepository.lockCategory(
      trx,
      ownerUserId,
      existing.categoryId,
    );
    if (!category) return null;
    const updated = await FinanceBudgetRepository.update(trx, ownerUserId, budgetId, patch);
    if (!updated) return null;
    await assertNestedBudgets(trx, ownerUserId, existing.categoryId, category.name);
    return updated;
  });
  return { budget: saved ? await toStatus(saved, primaryCurrency, new Date()) : null };
}

/**
 * Saves a category budget and the complete set of tag budgets nested inside it in one
 * transaction. Either every budget in the set is written or none is: a tag sum over the category
 * budget rejects the whole save with the overage named.
 */
export async function setCategoryBudgets(
  ownerUserId: string,
  input: {
    categoryId: string;
    amountCents: number;
    cadence: FinanceBudgetCadence;
    tagBudgets: TagBudgetWriteInput[];
  },
) {
  const primaryCurrency = await requirePrimaryCurrency(ownerUserId);
  const saved = await runInTransaction(async (trx) => {
    const category = await FinanceBudgetRepository.lockCategory(trx, ownerUserId, input.categoryId);
    if (!category) return null;
    await FinanceBudgetRepository.create(trx, ownerUserId, {
      categoryId: input.categoryId,
      amountCents: input.amountCents,
      cadence: input.cadence,
    });
    await FinanceBudgetRepository.replaceTagBudgets(
      trx,
      ownerUserId,
      input.categoryId,
      input.tagBudgets,
    );
    await assertNestedBudgets(trx, ownerUserId, input.categoryId, category.name);
    return FinanceBudgetRepository.getByCategory(trx, ownerUserId, input.categoryId);
  });
  return {
    budget: saved ? await toStatus(saved, primaryCurrency, new Date()) : null,
    reason: saved ? null : ('unknown_category' as const),
  };
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
        tagName: budget.tagName,
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
