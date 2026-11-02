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

/**
 * Converts an amount from one cadence to another (52 weekly, 12 monthly, 4 quarterly, 1 annual
 * period a year), rounded to the nearest cent. Nested budgets are summed in the category
 * budget's cadence, so a weekly tag budget can sit inside a monthly category budget.
 */
export function budgetAmountInCadence(
  amountCents: number,
  sourceCadence: FinanceBudgetCadence,
  targetCadence: FinanceBudgetCadence,
): number {
  return Math.round(
    (amountCents * PERIODS_PER_YEAR[sourceCadence]) / PERIODS_PER_YEAR[targetCadence],
  );
}

/** The finance transactions table `app.tag_assignments` names in `entity_table`. */
const FINANCE_TRANSACTION_ENTITY_TABLE = 'app.finance_transactions';

/** The budget as the API exposes it: flat, JSON-serializable, no row types. */
export type FinanceBudgetRecord = {
  id: string;
  userId: string;
  categoryId: string;
  categoryName: string;
  /** Null on a category budget; set on a tag budget nested inside that category. */
  tagId: string | null;
  tagName: string | null;
  amountCents: number;
  cadence: FinanceBudgetCadence;
  createdAt: string;
  updatedAt: string;
};

export type FinanceBudgetWriteInput = {
  categoryId: string;
  amountCents: number;
  cadence: FinanceBudgetCadence;
  /** Set to create or replace the budget for that tag inside the category. */
  tagId?: string | null;
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
  /** Count only transactions carrying this tag. Omitted counts the whole category. */
  tagId?: string;
};

export type FinanceCategoryBudgetMerge = {
  budget: { amountCents: number; cadence: FinanceBudgetCadence } | null;
  tagBudgets: Array<{
    tagId: string;
    amountCents: number;
    cadence: FinanceBudgetCadence;
  }>;
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

type BudgetJoinRow = FinanceBudgetRow & { categoryName: string; tagName: string | null };

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
    tagId: row.tagId,
    tagName: row.tagName,
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
  'budget.tagId',
  'budget.amountCents',
  'budget.cadence',
  'budget.createdAt',
  'budget.updatedAt',
  'category.name as categoryName',
  'tag.name as tagName',
] as const;

/** Category budgets join their category; tag budgets additionally join their own tag. */
function budgetsQuery(handle: DbHandle) {
  return handle
    .selectFrom('app.financeBudgets as budget')
    .innerJoin('app.financeCategories as category', 'category.id', 'budget.categoryId')
    .leftJoin('app.tags as tag', (join) =>
      join.onRef('tag.id', '=', 'budget.tagId').onRef('tag.ownerUserid', '=', 'budget.userId'),
    );
}

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
      return { budget: null, tagBudgets: [], sourceBudgetCount: 0, monthlyRunwayBudgets: [] };
    }

    for (const categoryId of [...sourceCategoryIds, targetCategoryId].sort()) {
      if (!(await FinanceBudgetRepository.lockCategory(handle, ownerUserId, categoryId))) {
        throw new ValidationError('A category disappeared while its budgets were being merged.', {
          ownerUserId,
          categoryId,
        });
      }
    }

    const budgets = await handle
      .selectFrom('app.financeBudgets')
      .select(['id', 'categoryId', 'tagId', 'amountCents', 'cadence'])
      .where('userId', '=', ownerUserId)
      .where('categoryId', 'in', [...sourceCategoryIds, targetCategoryId])
      .execute();
    const categoryBudgets = budgets.filter((budget) => budget.tagId === null);
    const nestedBudgets = budgets.filter((budget) => budget.tagId !== null);
    const target = categoryBudgets.find((budget) => budget.categoryId === targetCategoryId);
    const sourceBudgets = sourceCategoryIds.flatMap((categoryId) => {
      const budget = categoryBudgets.find((candidate) => candidate.categoryId === categoryId);
      return budget ? [budget] : [];
    });

    let mergedBudget: FinanceCategoryBudgetMerge['budget'] = target
      ? { amountCents: target.amountCents, cadence: toCadence(target.cadence) }
      : null;
    const mergedTagBudgets: FinanceCategoryBudgetMerge['tagBudgets'] = [];
    if (sourceBudgets.length > 0) {
      const cadence = mergedBudget?.cadence ?? toCadence(sourceBudgets[0]!.cadence);
      const sourceAmountCents = sourceBudgets.reduce(
        (total, budget) =>
          total + budgetAmountInCadence(budget.amountCents, toCadence(budget.cadence), cadence),
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
          .where('tagId', 'is', null)
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
          .where('tagId', 'is', null)
          .execute();
      }
    }

    const tagIds = [
      ...new Set(nestedBudgets.flatMap((budget) => (budget.tagId ? [budget.tagId] : []))),
    ].sort();
    for (const tagId of tagIds) {
      const targetTagBudget = nestedBudgets.find(
        (budget) => budget.categoryId === targetCategoryId && budget.tagId === tagId,
      );
      const sourceTagBudgets = sourceCategoryIds.flatMap((categoryId) => {
        const budget = nestedBudgets.find(
          (candidate) => candidate.categoryId === categoryId && candidate.tagId === tagId,
        );
        return budget ? [budget] : [];
      });
      const cadence = toCadence((targetTagBudget ?? sourceTagBudgets[0]!).cadence);
      const amountCents =
        (targetTagBudget?.amountCents ?? 0) +
        sourceTagBudgets.reduce(
          (total, budget) =>
            total + budgetAmountInCadence(budget.amountCents, toCadence(budget.cadence), cadence),
          0,
        );
      if (!Number.isSafeInteger(amountCents) || amountCents > MAX_BUDGET_CENTS) {
        throw new ValidationError('Merged tag budget exceeds the maximum supported amount.', {
          ownerUserId,
          targetCategoryId,
          tagId,
        });
      }
      mergedTagBudgets.push({ tagId, amountCents, cadence });

      if (targetTagBudget) {
        if (!options?.dryRun && sourceTagBudgets.length > 0) {
          await handle
            .updateTable('app.financeBudgets')
            .set({ amountCents, updatedAt: new Date().toISOString() })
            .where('userId', '=', ownerUserId)
            .where('id', '=', targetTagBudget.id)
            .execute();
          await handle
            .deleteFrom('app.financeBudgets')
            .where('userId', '=', ownerUserId)
            .where('categoryId', 'in', sourceCategoryIds)
            .where('tagId', '=', tagId)
            .execute();
        }
      } else if (!options?.dryRun && sourceTagBudgets.length > 0) {
        const first = sourceTagBudgets[0]!;
        await handle
          .updateTable('app.financeBudgets')
          .set({ categoryId: targetCategoryId, amountCents, updatedAt: new Date().toISOString() })
          .where('userId', '=', ownerUserId)
          .where('id', '=', first.id)
          .execute();
        await handle
          .deleteFrom('app.financeBudgets')
          .where('userId', '=', ownerUserId)
          .where('categoryId', 'in', sourceCategoryIds)
          .where('tagId', '=', tagId)
          .where('id', '!=', first.id)
          .execute();
      }
    }

    if (mergedTagBudgets.length > 0 && !mergedBudget) {
      throw new ValidationError('Nested tag budgets require a merged category budget.', {
        targetCategoryId,
      });
    }
    if (mergedBudget) {
      const tagBudgetSumCents = mergedTagBudgets.reduce(
        (sum, budget) =>
          sum + budgetAmountInCadence(budget.amountCents, budget.cadence, mergedBudget!.cadence),
        0,
      );
      if (tagBudgetSumCents > mergedBudget.amountCents) {
        throw new ValidationError(
          `Merged tag budgets total ${tagBudgetSumCents} cents (${mergedBudget.cadence}), which exceeds the merged category budget of ${mergedBudget.amountCents} cents. Nothing was merged.`,
          { targetCategoryId, tagBudgetSumCents, categoryBudgetCents: mergedBudget.amountCents },
        );
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
        tagBudgets: mergedTagBudgets,
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

    return {
      budget: mergedBudget,
      tagBudgets: mergedTagBudgets,
      sourceBudgetCount: sourceBudgets.length,
      monthlyRunwayBudgets,
    };
  },

  /** Category budgets only: tag budgets are read with their category. */
  async list(handle: DbHandle, ownerUserId: string, limit = 50): Promise<FinanceBudgetRecord[]> {
    const rows = await budgetsQuery(handle)
      .select(BUDGET_COLUMNS)
      .where('budget.userId', '=', ownerUserId)
      .where('category.userId', '=', ownerUserId)
      .where('budget.tagId', 'is', null)
      .orderBy('category.name', 'asc')
      .limit(limit)
      .execute();
    return rows.map(toBudget);
  },

  /** A category's budget and every tag budget nested inside it. */
  async listByCategory(
    handle: DbHandle,
    ownerUserId: string,
    categoryId: string,
  ): Promise<FinanceBudgetRecord[]> {
    const rows = await budgetsQuery(handle)
      .select(BUDGET_COLUMNS)
      .where('budget.userId', '=', ownerUserId)
      .where('budget.categoryId', '=', categoryId)
      .where('category.userId', '=', ownerUserId)
      .orderBy(sql`budget.tag_id asc nulls first`)
      .execute();
    return rows.map(toBudget);
  },

  async get(
    handle: DbHandle,
    ownerUserId: string,
    id: string,
  ): Promise<FinanceBudgetRecord | null> {
    const row = await budgetsQuery(handle)
      .select(BUDGET_COLUMNS)
      .where('budget.id', '=', id)
      .where('budget.userId', '=', ownerUserId)
      .where('category.userId', '=', ownerUserId)
      .executeTakeFirst();
    return row ? toBudget(row) : null;
  },

  /** The category budget of a category (never one of its tag budgets). */
  async getByCategory(
    handle: DbHandle,
    ownerUserId: string,
    categoryId: string,
  ): Promise<FinanceBudgetRecord | null> {
    const row = await budgetsQuery(handle)
      .select(BUDGET_COLUMNS)
      .where('budget.userId', '=', ownerUserId)
      .where('budget.categoryId', '=', categoryId)
      .where('budget.tagId', 'is', null)
      .where('category.userId', '=', ownerUserId)
      .executeTakeFirst();
    return row ? toBudget(row) : null;
  },

  /**
   * Serialises every write that can change the nested-budget invariant: holding the category's
   * row lock means two concurrent saves cannot each pass the check and together exceed it.
   * Returns null when the category is not the caller's.
   */
  async lockCategory(
    handle: DbHandle,
    ownerUserId: string,
    categoryId: string,
  ): Promise<{ id: string; name: string } | null> {
    const row = await handle
      .selectFrom('app.financeCategories')
      .select(['id', 'name'])
      .where('id', '=', categoryId)
      .where('userId', '=', ownerUserId)
      .forUpdate()
      .executeTakeFirst();
    return row ?? null;
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

  /**
   * One category budget per (user, category), and one budget per tag inside that category: a
   * second create for the same scope updates the existing row. Runs inside the caller's
   * transaction, which holds the category budget row's lock.
   */
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

    const tagId = input.tagId ?? null;
    if (tagId) {
      const tag = await handle
        .selectFrom('app.tags')
        .select('id')
        .where('id', '=', tagId)
        .where('ownerUserid', '=', ownerUserId)
        .executeTakeFirst();
      if (!tag) throw new NotFoundError('Tag not found');
    }

    const existing = await (
      tagId
        ? handle
            .selectFrom('app.financeBudgets')
            .select('id')
            .where('userId', '=', ownerUserId)
            .where('categoryId', '=', input.categoryId)
            .where('tagId', '=', tagId)
        : handle
            .selectFrom('app.financeBudgets')
            .select('id')
            .where('userId', '=', ownerUserId)
            .where('categoryId', '=', input.categoryId)
            .where('tagId', 'is', null)
    ).executeTakeFirst();

    if (existing) {
      await handle
        .updateTable('app.financeBudgets')
        .set({
          amountCents: input.amountCents,
          cadence: input.cadence,
          updatedAt: new Date().toISOString(),
        })
        .where('userId', '=', ownerUserId)
        .where('id', '=', existing.id)
        .execute();
    } else {
      await handle
        .insertInto('app.financeBudgets')
        .values({
          userId: ownerUserId,
          categoryId: input.categoryId,
          tagId,
          amountCents: input.amountCents,
          cadence: input.cadence,
        })
        .execute();
    }

    const budget = (
      await FinanceBudgetRepository.listByCategory(handle, ownerUserId, input.categoryId)
    ).find((candidate) => candidate.tagId === tagId);
    if (!budget) throw new NotFoundError('Budget not found');
    return { budget, created: !existing };
  },

  /**
   * Makes the category's tag budgets exactly `inputs`: existing rows are updated in place (so
   * their tracking start is kept), rows for tags no longer listed are removed.
   */
  async replaceTagBudgets(
    handle: DbHandle,
    ownerUserId: string,
    categoryId: string,
    inputs: ReadonlyArray<{ tagId: string; amountCents: number; cadence: FinanceBudgetCadence }>,
  ): Promise<FinanceBudgetRecord[]> {
    const existing = await handle
      .selectFrom('app.financeBudgets')
      .select('tagId')
      .where('userId', '=', ownerUserId)
      .where('categoryId', '=', categoryId)
      .where('tagId', 'is not', null)
      .execute();
    const desired = new Set(inputs.map((input) => input.tagId));
    const removedTagIds = existing.flatMap((row) =>
      row.tagId && !desired.has(row.tagId) ? [row.tagId] : [],
    );
    if (removedTagIds.length > 0) {
      await handle
        .deleteFrom('app.financeBudgets')
        .where('userId', '=', ownerUserId)
        .where('categoryId', '=', categoryId)
        .where('tagId', 'in', removedTagIds)
        .execute();
    }

    for (const input of inputs) {
      await FinanceBudgetRepository.create(handle, ownerUserId, { categoryId, ...input });
    }
    return (await FinanceBudgetRepository.listByCategory(handle, ownerUserId, categoryId)).filter(
      (budget) => budget.tagId !== null,
    );
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

  /** Deleting a category budget also deletes the tag budgets nested inside it. */
  async remove(handle: DbHandle, ownerUserId: string, id: string): Promise<boolean> {
    const target = await handle
      .selectFrom('app.financeBudgets')
      .select(['categoryId', 'tagId'])
      .where('id', '=', id)
      .where('userId', '=', ownerUserId)
      .executeTakeFirst();
    if (!target) return false;
    const result = await handle
      .deleteFrom('app.financeBudgets')
      .where('userId', '=', ownerUserId)
      .$if(target.tagId === null, (query) => query.where('categoryId', '=', target.categoryId))
      .$if(target.tagId !== null, (query) => query.where('id', '=', id))
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
    // A tag budget counts only the category's transactions carrying that tag, using the same
    // spend rules as the category budget it sits inside.
    const tagFilter = range.tagId
      ? sql<boolean>`exists (
          select 1 from app.tag_assignments ta
          where ta.entity_table = ${FINANCE_TRANSACTION_ENTITY_TABLE}::regclass
            and ta.entity_id = t.id
            and ta.tag_id = ${range.tagId}
            and ta.removed_at is null
        )`
      : sql<boolean>`true`;
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
      .where(tagFilter)
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
    const tagFilter = range.tagId
      ? sql<boolean>`exists (
          select 1 from app.tag_assignments ta
          where ta.entity_table = ${FINANCE_TRANSACTION_ENTITY_TABLE}::regclass
            and ta.entity_id = t.id
            and ta.tag_id = ${range.tagId}
            and ta.removed_at is null
        )`
      : sql<boolean>`true`;
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
      .where(tagFilter)
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
