import { sql, type Selectable } from 'kysely';

import { NotFoundError, ValidationError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type { AppFinanceBudgets } from '../../types/database';

type FinanceBudgetRow = Selectable<AppFinanceBudgets>;

/** Fixed set for V1: a custom period (every 45 days, every 6 months) is not a cadence. */
export const FINANCE_BUDGET_CADENCES = ['weekly', 'monthly', 'quarterly', 'annual'] as const;

export type FinanceBudgetCadence = (typeof FINANCE_BUDGET_CADENCES)[number];

const PERIODS_PER_YEAR: Record<FinanceBudgetCadence, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  annual: 1,
};

const MAX_BUDGET_CENTS = 2_147_483_647;

function amountInCadence(
  amountCents: number,
  sourceCadence: FinanceBudgetCadence,
  targetCadence: FinanceBudgetCadence,
): number {
  return Math.round(
    (amountCents * PERIODS_PER_YEAR[sourceCadence]) / PERIODS_PER_YEAR[targetCadence],
  );
}

/** The budget as the API exposes it: flat, JSON-serializable, no row types. */
export type FinanceBudgetRecord = {
  id: string;
  userId: string;
  categoryId: string;
  categoryName: string;
  amountCents: number;
  cadence: FinanceBudgetCadence;
  createdAt: string;
  updatedAt: string;
};

export type FinanceBudgetWriteInput = {
  categoryId: string;
  amountCents: number;
  cadence: FinanceBudgetCadence;
};

export type FinanceBudgetPatch = {
  amountCents?: number;
  cadence?: FinanceBudgetCadence;
};

export type FinanceBudgetSpendRange = {
  categoryId: string;
  primaryCurrency: string;
  /** Inclusive first transaction date (YYYY-MM-DD). */
  from: string;
  /** Exclusive last transaction date (YYYY-MM-DD). */
  to: string;
};

export type FinanceCategoryBudgetMerge = {
  budget: { amountCents: number; cadence: FinanceBudgetCadence } | null;
  sourceBudgetCount: number;
  monthlyRunwayBudgets: Array<{ currencyCode: string; amountCents: number }>;
};

export type FinanceSpendTotal = {
  spentCents: number;
  uncountedForeignTransactionCount: number;
};

export type UncountedForeignTransaction = {
  id: string;
  postedOn: string;
  currencyCode: string;
  amountCents: number;
  merchantName: string | null;
  description: string | null;
};

type BudgetJoinRow = FinanceBudgetRow & { categoryName: string };

function toCurrencyCents(value: unknown): number {
  return Math.round(Number(value ?? 0) * 100);
}

function toCadence(value: string): FinanceBudgetCadence {
  const match = FINANCE_BUDGET_CADENCES.find((cadence) => cadence === value);
  if (!match) throw new Error(`Unknown finance budget cadence: ${value}`);
  return match;
}

function toBudget(row: BudgetJoinRow): FinanceBudgetRecord {
  return {
    id: row.id,
    userId: row.userId,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    amountCents: row.amountCents,
    cadence: toCadence(row.cadence),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

const BUDGET_COLUMNS = [
  'budget.id',
  'budget.userId',
  'budget.categoryId',
  'budget.amountCents',
  'budget.cadence',
  'budget.createdAt',
  'budget.updatedAt',
  'category.name as categoryName',
] as const;

/**
 * Budgets are owner-scoped rows joined to their category, and spend is never stored: the
 * transaction queries here are the only source of a budget's spent total.
 */
export const FinanceBudgetRepository = {
  async mergeCategories(
    handle: DbHandle,
    ownerUserId: string,
    targetCategoryId: string,
    sourceCategoryIds: string[],
    options?: { dryRun?: boolean },
  ): Promise<FinanceCategoryBudgetMerge> {
    if (sourceCategoryIds.length === 0) {
      return { budget: null, sourceBudgetCount: 0, monthlyRunwayBudgets: [] };
    }

    const budgets = await handle
      .selectFrom('app.financeBudgets')
      .select(['id', 'categoryId', 'amountCents', 'cadence'])
      .where('userId', '=', ownerUserId)
      .where('categoryId', 'in', [...sourceCategoryIds, targetCategoryId])
      .execute();
    const target = budgets.find((budget) => budget.categoryId === targetCategoryId);
    const sourceBudgets = sourceCategoryIds.flatMap((categoryId) => {
      const budget = budgets.find((candidate) => candidate.categoryId === categoryId);
      return budget ? [budget] : [];
    });

    let mergedBudget: FinanceCategoryBudgetMerge['budget'] = target
      ? { amountCents: target.amountCents, cadence: toCadence(target.cadence) }
      : null;
    if (sourceBudgets.length > 0) {
      const cadence = mergedBudget?.cadence ?? toCadence(sourceBudgets[0]!.cadence);
      const sourceAmountCents = sourceBudgets.reduce(
        (total, budget) =>
          total + amountInCadence(budget.amountCents, toCadence(budget.cadence), cadence),
        0,
      );
      const amountCents = (target?.amountCents ?? 0) + sourceAmountCents;
      if (!Number.isSafeInteger(amountCents) || amountCents > MAX_BUDGET_CENTS) {
        throw new ValidationError('Merged budget exceeds the maximum supported amount.', {
          ownerUserId,
          targetCategoryId,
        });
      }

      mergedBudget = { amountCents, cadence };

      if (!options?.dryRun && target) {
        await handle
          .updateTable('app.financeBudgets')
          .set({ amountCents, updatedAt: new Date().toISOString() })
          .where('userId', '=', ownerUserId)
          .where('id', '=', target.id)
          .execute();
        await handle
          .deleteFrom('app.financeBudgets')
          .where('userId', '=', ownerUserId)
          .where('categoryId', 'in', sourceCategoryIds)
          .execute();
      } else if (!options?.dryRun) {
        const first = sourceBudgets[0]!;
        await handle
          .updateTable('app.financeBudgets')
          .set({ categoryId: targetCategoryId, amountCents, updatedAt: new Date().toISOString() })
          .where('userId', '=', ownerUserId)
          .where('id', '=', first.id)
          .execute();
        await handle
          .deleteFrom('app.financeBudgets')
          .where('userId', '=', ownerUserId)
          .where(
            'categoryId',
            'in',
            sourceCategoryIds.filter((id) => id !== first.categoryId),
          )
          .execute();
      }
    }

    const monthlyBudgets = await handle
      .selectFrom('app.financeMonthlyBudgets')
      .select('currencyCode')
      .select((eb) => eb.fn.sum<string>('monthlyAmount').as('monthlyAmount'))
      .where('userId', '=', ownerUserId)
      .where('categoryId', 'in', [...sourceCategoryIds, targetCategoryId])
      .groupBy('currencyCode')
      .orderBy('currencyCode', 'asc')
      .execute();
    const monthlyRunwayBudgets = monthlyBudgets.map((budget) => ({
      currencyCode: budget.currencyCode,
      amountCents: Math.round(Number(budget.monthlyAmount) * 100),
    }));

    if (options?.dryRun) {
      return {
        budget: mergedBudget,
        sourceBudgetCount: sourceBudgets.length,
        monthlyRunwayBudgets,
      };
    }

    await sql`
      INSERT INTO app.finance_monthly_budgets (
        id, user_id, category_id, currency_code, monthly_amount, created_at, updated_at
      )
      SELECT uuidv7(), ${ownerUserId}, ${targetCategoryId}, currency_code,
        sum(monthly_amount), min(created_at), now()
      FROM app.finance_monthly_budgets
      WHERE user_id = ${ownerUserId}
        AND category_id = ANY(${sourceCategoryIds}::uuid[])
      GROUP BY currency_code
      ON CONFLICT (user_id, category_id, currency_code)
      DO UPDATE SET
        monthly_amount = app.finance_monthly_budgets.monthly_amount + EXCLUDED.monthly_amount,
        updated_at = now()
    `.execute(handle);

    await handle
      .deleteFrom('app.financeMonthlyBudgets')
      .where('userId', '=', ownerUserId)
      .where('categoryId', 'in', sourceCategoryIds)
      .execute();

    return { budget: mergedBudget, sourceBudgetCount: sourceBudgets.length, monthlyRunwayBudgets };
  },

  async list(handle: DbHandle, ownerUserId: string, limit = 50): Promise<FinanceBudgetRecord[]> {
    const rows = await handle
      .selectFrom('app.financeBudgets as budget')
      .innerJoin('app.financeCategories as category', 'category.id', 'budget.categoryId')
      .select(BUDGET_COLUMNS)
      .where('budget.userId', '=', ownerUserId)
      .where('category.userId', '=', ownerUserId)
      .orderBy('category.name', 'asc')
      .limit(limit)
      .execute();
    return rows.map(toBudget);
  },

  async get(
    handle: DbHandle,
    ownerUserId: string,
    id: string,
  ): Promise<FinanceBudgetRecord | null> {
    const row = await handle
      .selectFrom('app.financeBudgets as budget')
      .innerJoin('app.financeCategories as category', 'category.id', 'budget.categoryId')
      .select(BUDGET_COLUMNS)
      .where('budget.id', '=', id)
      .where('budget.userId', '=', ownerUserId)
      .where('category.userId', '=', ownerUserId)
      .executeTakeFirst();
    return row ? toBudget(row) : null;
  },

  async getByCategory(
    handle: DbHandle,
    ownerUserId: string,
    categoryId: string,
  ): Promise<FinanceBudgetRecord | null> {
    const row = await handle
      .selectFrom('app.financeBudgets as budget')
      .innerJoin('app.financeCategories as category', 'category.id', 'budget.categoryId')
      .select(BUDGET_COLUMNS)
      .where('budget.userId', '=', ownerUserId)
      .where('budget.categoryId', '=', categoryId)
      .where('category.userId', '=', ownerUserId)
      .executeTakeFirst();
    return row ? toBudget(row) : null;
  },

  async findCategory(
    handle: DbHandle,
    ownerUserId: string,
    categoryId: string,
  ): Promise<{ id: string; name: string } | null> {
    const row = await handle
      .selectFrom('app.financeCategories')
      .select(['id', 'name'])
      .where('id', '=', categoryId)
      .where('userId', '=', ownerUserId)
      .executeTakeFirst();
    return row ?? null;
  },

  async findOrCreateCategory(
    handle: DbHandle,
    ownerUserId: string,
    name: string,
  ): Promise<{ id: string; name: string }> {
    const existing = await handle
      .selectFrom('app.financeCategories')
      .select(['id', 'name'])
      .where('userId', '=', ownerUserId)
      .where(sql<string>`lower(name)`, '=', name.trim().toLowerCase())
      .executeTakeFirst();
    if (existing) return existing;
    const created = await handle
      .insertInto('app.financeCategories')
      .values({ userId: ownerUserId, name: name.trim() })
      .returning(['id', 'name'])
      .executeTakeFirstOrThrow();
    return created;
  },

  /** One row per (user, category): a second create for the same category updates it. */
  async create(
    handle: DbHandle,
    ownerUserId: string,
    input: FinanceBudgetWriteInput,
  ): Promise<{ budget: FinanceBudgetRecord; created: boolean }> {
    const category = await FinanceBudgetRepository.findCategory(
      handle,
      ownerUserId,
      input.categoryId,
    );
    if (!category) throw new NotFoundError('Category not found');

    const existing = await handle
      .selectFrom('app.financeBudgets')
      .select('id')
      .where('userId', '=', ownerUserId)
      .where('categoryId', '=', input.categoryId)
      .executeTakeFirst();

    await handle
      .insertInto('app.financeBudgets')
      .values({
        userId: ownerUserId,
        categoryId: input.categoryId,
        amountCents: input.amountCents,
        cadence: input.cadence,
      })
      .onConflict((conflict) =>
        conflict.columns(['userId', 'categoryId']).doUpdateSet({
          amountCents: input.amountCents,
          cadence: input.cadence,
          updatedAt: new Date().toISOString(),
        }),
      )
      .execute();

    const budget = await FinanceBudgetRepository.getByCategory(
      handle,
      ownerUserId,
      input.categoryId,
    );
    if (!budget) throw new NotFoundError('Budget not found');
    return { budget, created: !existing };
  },

  async update(
    handle: DbHandle,
    ownerUserId: string,
    id: string,
    patch: FinanceBudgetPatch,
  ): Promise<FinanceBudgetRecord | null> {
    const result = await handle
      .updateTable('app.financeBudgets')
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where('id', '=', id)
      .where('userId', '=', ownerUserId)
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) === 0) return null;
    return FinanceBudgetRepository.get(handle, ownerUserId, id);
  },

  async remove(handle: DbHandle, ownerUserId: string, id: string): Promise<boolean> {
    const result = await handle
      .deleteFrom('app.financeBudgets')
      .where('id', '=', id)
      .where('userId', '=', ownerUserId)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  },

  async getPrimaryCurrency(handle: DbHandle, ownerUserId: string): Promise<string | null> {
    const row = await handle
      .selectFrom('app.userProfiles')
      .select('primaryCurrency')
      .where('userId', '=', ownerUserId)
      .executeTakeFirst();
    return row?.primaryCurrency ?? null;
  },

  async setPrimaryCurrency(
    handle: DbHandle,
    ownerUserId: string,
    primaryCurrency: string,
  ): Promise<string> {
    const row = await handle
      .insertInto('app.userProfiles')
      .values({ userId: ownerUserId, primaryCurrency })
      .onConflict((conflict) =>
        conflict.column('userId').doUpdateSet({
          primaryCurrency,
          updatedAt: new Date().toISOString(),
        }),
      )
      .returning('primaryCurrency')
      .executeTakeFirst();
    if (!row) throw new NotFoundError('User profile not found');
    return row.primaryCurrency;
  },

  /**
   * Spent in one category over [from, to), in the primary currency. A primary-currency
   * transaction counts its own amount; a foreign one counts only its settled primary-currency
   * amount, the amount actually charged. Anything else is reported as uncounted, never
   * converted at an invented rate. Spending is negative transaction amounts only, matching
   * the finance report tools.
   */
  async getSpentTotal(
    handle: DbHandle,
    ownerUserId: string,
    range: FinanceBudgetSpendRange,
  ): Promise<FinanceSpendTotal> {
    const row = await handle
      .selectFrom('app.financeTransactions as t')
      .select([
        sql<number>`coalesce(sum(
          CASE
            WHEN t.currency_code = ${range.primaryCurrency} THEN -t.amount
            WHEN t.settled_currency_code = ${range.primaryCurrency} THEN t.settled_amount
            ELSE 0
          END
        ), 0)`.as('spent'),
        sql<number>`count(*) FILTER (
          WHERE t.currency_code <> ${range.primaryCurrency}
            AND (t.settled_currency_code IS NULL OR t.settled_currency_code <> ${range.primaryCurrency})
        )`.as('uncountedCount'),
      ])
      .where('t.userId', '=', ownerUserId)
      .where('t.categoryId', '=', range.categoryId)
      .where('t.pending', '=', false)
      .where('t.excluded', '=', false)
      .where('t.transactionType', '!=', 'transfer')
      .where(sql<boolean>`t.amount < 0`)
      .where('t.postedOn', '>=', range.from)
      .where('t.postedOn', '<', range.to)
      .executeTakeFirst();
    return {
      spentCents: toCurrencyCents(row?.spent),
      uncountedForeignTransactionCount: Number(row?.uncountedCount ?? 0),
    };
  },

  /**
   * Spent per calendar period in one category over [from, to), keyed by the period's start
   * date. Used to fold rollover period by period; `date_trunc` matches the cadence's own
   * calendar period (week starts Monday).
   */
  async getSpendByPeriod(
    handle: DbHandle,
    ownerUserId: string,
    range: FinanceBudgetSpendRange & { cadence: FinanceBudgetCadence },
  ): Promise<Map<string, number>> {
    const unit =
      range.cadence === 'weekly'
        ? 'week'
        : range.cadence === 'monthly'
          ? 'month'
          : range.cadence === 'quarterly'
            ? 'quarter'
            : 'year';
    const periodStart = sql<string>`date_trunc(${unit}, t.posted_on)::date::text`;
    const rows = await handle
      .selectFrom('app.financeTransactions as t')
      .select([
        periodStart.as('periodStart'),
        sql<number>`coalesce(sum(
          CASE
            WHEN t.currency_code = ${range.primaryCurrency} THEN -t.amount
            WHEN t.settled_currency_code = ${range.primaryCurrency} THEN t.settled_amount
            ELSE 0
          END
        ), 0)`.as('spent'),
      ])
      .where('t.userId', '=', ownerUserId)
      .where('t.categoryId', '=', range.categoryId)
      .where('t.pending', '=', false)
      .where('t.excluded', '=', false)
      .where('t.transactionType', '!=', 'transfer')
      .where(sql<boolean>`t.amount < 0`)
      .where('t.postedOn', '>=', range.from)
      .where('t.postedOn', '<', range.to)
      // Group by ordinal: the select's period expression is cast to text, so it is not
      // textually identical to a repeated `date_trunc(...)::date` group expression.
      .groupBy(sql`1`)
      .execute();
    return new Map(rows.map((row) => [String(row.periodStart), toCurrencyCents(row.spent)]));
  },

  async listUncountedForeignTransactions(
    handle: DbHandle,
    ownerUserId: string,
    range: FinanceBudgetSpendRange,
    limit = 25,
  ): Promise<UncountedForeignTransaction[]> {
    const rows = await handle
      .selectFrom('app.financeTransactions as t')
      .select([
        't.id',
        't.postedOn',
        't.currencyCode',
        't.amount',
        't.merchantName',
        't.description',
      ])
      .where('t.userId', '=', ownerUserId)
      .where('t.categoryId', '=', range.categoryId)
      .where('t.pending', '=', false)
      .where('t.excluded', '=', false)
      .where('t.transactionType', '!=', 'transfer')
      .where(sql<boolean>`t.amount < 0`)
      .where('t.postedOn', '>=', range.from)
      .where('t.postedOn', '<', range.to)
      .where(sql<boolean>`t.currency_code <> ${range.primaryCurrency}`)
      .where(
        sql<boolean>`(t.settled_currency_code IS NULL OR t.settled_currency_code <> ${range.primaryCurrency})`,
      )
      .orderBy('t.postedOn', 'asc')
      .limit(limit)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      postedOn: String(row.postedOn),
      currencyCode: row.currencyCode,
      amountCents: Math.round(Math.abs(Number(row.amount)) * 100),
      merchantName: row.merchantName,
      description: row.description,
    }));
  },
};
