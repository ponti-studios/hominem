import { db, runInTransaction, type DbHandle } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';
import {
  FinanceBudgetRepository,
  type FinanceBudgetCadence,
  type FinanceBudgetRecord,
  type UncountedForeignTransaction,
} from '@hominem/db/finance';
import { resolvePreviewFinanceCategoryId } from '@hominem/finance-services';

import { previewNestedBudgets, validateNestedBudgets } from './finance-budget-nesting';
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
  dryRun?: boolean;
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
      { reason: 'primary_currency_unset' },
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
    budgetId: string;
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
          budgetId: tag.id,
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

  const { openingBalanceCents: openingBalance, sweptToSavingsCents: sweptToSavings } = isTagBudget
    ? { openingBalanceCents: 0, sweptToSavingsCents: 0 }
    : computeRollover({
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
  const primaryCurrency = await FinanceBudgetRepository.getPrimaryCurrency(db, ownerUserId);
  const categoryBudgets = await FinanceBudgetRepository.list(db, ownerUserId, 500);
  const budgets = primaryCurrency
    ? categoryBudgets
    : (
        await Promise.all(
          categoryBudgets.map((budget) =>
            FinanceBudgetRepository.listByCategory(db, ownerUserId, budget.categoryId),
          ),
        )
      ).flat();
  if (!primaryCurrency) {
    return {
      primaryCurrency: null,
      budgets: budgets.map(
        ({ id, categoryId, categoryName, tagId, tagName, amountCents, cadence }) => ({
          id,
          categoryId,
          categoryName,
          tagId,
          tagName,
          amountCents,
          cadence,
        }),
      ),
      breaches: [],
      count: budgets.length,
      warning: 'Primary currency is unset; budget amounts are shown without spend calculations.',
      storedBudgets: budgets.map(
        ({ id, categoryId, categoryName, tagId, tagName, amountCents, cadence }) => ({
          id,
          categoryId,
          categoryName,
          tagId,
          tagName,
          amountCents,
          cadence,
        }),
      ),
    };
  }
  const now = new Date();
  const statuses = await Promise.all(
    budgets.map((budget) => toStatus(budget, primaryCurrency, now)),
  );
  return {
    primaryCurrency,
    budgets: statuses,
    breaches: statuses.flatMap((status) => (status.breach ? [status.breach] : [])),
    count: statuses.length,
    warning: null,
    storedBudgets: [],
  };
}

export async function getBudget(ownerUserId: string, budgetId: string, now: Date = new Date()) {
  const budget = await FinanceBudgetRepository.get(db, ownerUserId, budgetId);
  const primaryCurrency = await FinanceBudgetRepository.getPrimaryCurrency(db, ownerUserId);
  if (!primaryCurrency) {
    return {
      budget: budget
        ? {
            id: budget.id,
            categoryId: budget.categoryId,
            categoryName: budget.categoryName,
            tagId: budget.tagId,
            tagName: budget.tagName,
            amountCents: budget.amountCents,
            cadence: budget.cadence,
          }
        : null,
      warning: 'Primary currency is unset; budget amounts are shown without spend calculations.',
      storedBudget: budget
        ? {
            id: budget.id,
            categoryId: budget.categoryId,
            categoryName: budget.categoryName,
            tagId: budget.tagId,
            tagName: budget.tagName,
            amountCents: budget.amountCents,
            cadence: budget.cadence,
          }
        : null,
    };
  }
  return {
    budget: budget ? await toStatus(budget, primaryCurrency, now) : null,
    warning: null,
    storedBudget: null,
  };
}

export async function createBudget(ownerUserId: string, input: BudgetWriteInput) {
  const category =
    input.dryRun && input.categoryId.startsWith('preview-category:')
      ? resolvePreviewFinanceCategoryId(ownerUserId, input.categoryId)
      : await FinanceBudgetRepository.findCategory(db, ownerUserId, input.categoryId);
  if (!category) {
    return {
      budget: null,
      created: false,
      reason: 'unknown_category' as const,
      dryRun: input.dryRun ?? false,
      preview: null,
    };
  }
  if (input.dryRun) {
    const rows = input.categoryId.startsWith('preview-category:')
      ? []
      : await FinanceBudgetRepository.listByCategory(db, ownerUserId, input.categoryId);
    const tagId = input.tagId ?? null;
    const existing = rows.find((row) => row.tagId === tagId);
    const projected = [
      ...rows
        .filter((row) => row.tagId !== tagId)
        .map((row) => ({
          id: row.id,
          tagId: row.tagId,
          amountCents: row.amountCents,
          cadence: row.cadence,
        })),
      { id: existing?.id ?? null, tagId, amountCents: input.amountCents, cadence: input.cadence },
    ];
    const categoryBudget = projected.find((row) => row.tagId === null);
    const validation = previewNestedBudgets({
      categoryName: category.name,
      categoryBudgetCents: categoryBudget?.amountCents ?? null,
      categoryCadence: categoryBudget?.cadence ?? input.cadence,
      tagBudgets: projected.flatMap((row) =>
        row.tagId === null ? [] : [{ amountCents: row.amountCents, cadence: row.cadence }],
      ),
    });
    return {
      budget: null,
      created: !existing,
      reason: null,
      dryRun: true,
      preview: {
        categoryId: category.id,
        categoryName: category.name,
        budgets: projected,
        validation: { ...validation, categoryBudgetCents: categoryBudget?.amountCents ?? null },
      },
    };
  }
  const primaryCurrency = await requirePrimaryCurrency(ownerUserId);
  const saved = await runInTransaction(async (trx) => {
    const category = await FinanceBudgetRepository.lockCategory(trx, ownerUserId, input.categoryId);
    if (!category) return null;
    const result = await FinanceBudgetRepository.create(trx, ownerUserId, input);
    await assertNestedBudgets(trx, ownerUserId, input.categoryId, category.name);
    return result;
  });
  if (!saved)
    return {
      budget: null,
      created: false,
      reason: 'unknown_category' as const,
      dryRun: false,
      preview: null,
    };
  return {
    budget: await toStatus(saved.budget, primaryCurrency, new Date()),
    created: saved.created,
    reason: null,
    dryRun: false,
    preview: null,
  };
}

export async function updateBudget(
  ownerUserId: string,
  budgetId: string,
  patch: { amountCents?: number; cadence?: FinanceBudgetCadence },
  options?: { dryRun?: boolean },
) {
  const existing = await FinanceBudgetRepository.get(db, ownerUserId, budgetId);
  if (!existing) return { budget: null, dryRun: options?.dryRun ?? false, preview: null };
  if (options?.dryRun) {
    const rows = await FinanceBudgetRepository.listByCategory(db, ownerUserId, existing.categoryId);
    const projected = rows.map((row) => ({
      id: row.id,
      tagId: row.tagId,
      amountCents: row.id === budgetId ? (patch.amountCents ?? row.amountCents) : row.amountCents,
      cadence: row.id === budgetId ? (patch.cadence ?? row.cadence) : row.cadence,
    }));
    const categoryBudget = projected.find((row) => row.tagId === null);
    const validation = previewNestedBudgets({
      categoryName: existing.categoryName,
      categoryBudgetCents: categoryBudget?.amountCents ?? null,
      categoryCadence: categoryBudget?.cadence ?? existing.cadence,
      tagBudgets: projected.flatMap((row) =>
        row.tagId === null ? [] : [{ amountCents: row.amountCents, cadence: row.cadence }],
      ),
    });
    return {
      budget: null,
      dryRun: true,
      preview: {
        categoryId: existing.categoryId,
        categoryName: existing.categoryName,
        budgets: projected,
        validation: { ...validation, categoryBudgetCents: categoryBudget?.amountCents ?? null },
      },
    };
  }
  const primaryCurrency = await requirePrimaryCurrency(ownerUserId);
  const saved = await runInTransaction(async (trx) => {
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
  return {
    budget: saved ? await toStatus(saved, primaryCurrency, new Date()) : null,
    dryRun: false,
    preview: null,
  };
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
    dryRun?: boolean;
  },
) {
  const category =
    input.dryRun && input.categoryId.startsWith('preview-category:')
      ? resolvePreviewFinanceCategoryId(ownerUserId, input.categoryId)
      : await FinanceBudgetRepository.findCategory(db, ownerUserId, input.categoryId);
  if (!category) {
    return {
      budget: null,
      reason: 'unknown_category' as const,
      dryRun: input.dryRun ?? false,
      preview: null,
    };
  }
  if (input.dryRun) {
    const rows = input.categoryId.startsWith('preview-category:')
      ? []
      : await FinanceBudgetRepository.listByCategory(db, ownerUserId, input.categoryId);
    const projected = [
      {
        id: rows.find((row) => row.tagId === null)?.id ?? null,
        tagId: null,
        amountCents: input.amountCents,
        cadence: input.cadence,
      },
      ...input.tagBudgets.map((budget) => ({
        id: rows.find((row) => row.tagId === budget.tagId)?.id ?? null,
        ...budget,
      })),
    ];
    const validation = previewNestedBudgets({
      categoryName: category.name,
      categoryBudgetCents: input.amountCents,
      categoryCadence: input.cadence,
      tagBudgets: input.tagBudgets,
    });
    return {
      budget: null,
      reason: null,
      dryRun: true,
      preview: {
        categoryId: category.id,
        categoryName: category.name,
        budgets: projected,
        validation: { ...validation, categoryBudgetCents: input.amountCents },
      },
    };
  }
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
    dryRun: false,
    preview: null,
  };
}

export async function deleteBudget(
  ownerUserId: string,
  budgetId: string,
  options?: { dryRun?: boolean },
) {
  if (options?.dryRun) {
    const budget = await FinanceBudgetRepository.get(db, ownerUserId, budgetId);
    if (!budget) return { removed: false, dryRun: true, preview: [] };
    const affected =
      budget.tagId === null
        ? await FinanceBudgetRepository.listByCategory(db, ownerUserId, budget.categoryId)
        : [budget];
    return {
      removed: false,
      dryRun: true,
      preview: affected.map(({ id, categoryId, categoryName, tagId, amountCents, cadence }) => ({
        id,
        categoryId,
        categoryName,
        tagId,
        amountCents,
        cadence,
      })),
    };
  }
  const removed = await runInTransaction(async (trx) => {
    const budget = await FinanceBudgetRepository.get(trx, ownerUserId, budgetId);
    if (!budget) return false;
    if (!(await FinanceBudgetRepository.lockCategory(trx, ownerUserId, budget.categoryId))) {
      return false;
    }
    return FinanceBudgetRepository.remove(trx, ownerUserId, budgetId);
  });
  return { removed, dryRun: false, preview: [] };
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

export async function setPrimaryCurrency(
  ownerUserId: string,
  currencyCode: string,
  options?: { dryRun?: boolean },
) {
  if (options?.dryRun) {
    const previousCurrency = await FinanceBudgetRepository.getPrimaryCurrency(db, ownerUserId);
    const categoryBudgets = await FinanceBudgetRepository.list(db, ownerUserId, 500);
    const affectedBudgets = (
      await Promise.all(
        categoryBudgets.map((budget) =>
          FinanceBudgetRepository.listByCategory(db, ownerUserId, budget.categoryId),
        ),
      )
    ).flat();
    return {
      primaryCurrency: currencyCode.toUpperCase(),
      dryRun: true,
      preview: {
        previousCurrency,
        affectedBudgets: affectedBudgets.map(
          ({ id, categoryId, categoryName, tagId, tagName, amountCents, cadence }) => ({
            id,
            categoryId,
            categoryName,
            tagId,
            tagName,
            amountCents,
            cadence,
          }),
        ),
      },
    };
  }
  const previousCurrency = await FinanceBudgetRepository.getPrimaryCurrency(db, ownerUserId);
  const primaryCurrency = await FinanceBudgetRepository.setPrimaryCurrency(
    db,
    ownerUserId,
    currencyCode.toUpperCase(),
  );
  return {
    primaryCurrency,
    dryRun: false,
    preview: { previousCurrency, affectedBudgets: [] },
  };
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
