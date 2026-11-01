import { db, sql } from '@hominem/db/core';
import type { DbHandle } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';

import { FINANCE_TRANSACTION_ENTITY_TYPE } from './contracts';
import { UNCATEGORIZED_NAME, ensureTagIds, resolveFinanceCategory } from './sheet-import';
import { toCents, toNumber } from './utils';

/**
 * Taxonomy under a category: tags are the drill-down layer. A category says *what bucket* a
 * transaction belongs to; the tags on that transaction say *which component of the bucket* it
 * came from. A merge preserves each absorbed category as a tag, so the bucket can always be
 * re-split along its former boundaries.
 */

export interface CategoryRef {
  id: string;
  name: string;
}

export type FinanceCategoryMergeReason =
  | 'protected_category'
  | 'unknown_category'
  | 'untagged_sources'
  | 'unrepointed_rules';

/**
 * Which stage of the ordered merge to run. `all` (the default) is the whole preserve → repoint →
 * merge flow; the others run one stage so the ordering can be driven and inspected step by step.
 * Skipping a stage is never free: the merge stage refuses while a source is untagged or a rule
 * still names one.
 */
export type CategoryMergeStage = 'all' | 'preserve' | 'repoint' | 'merge';

export interface MergeCategoryInput {
  /** One or more categories to fold away, by name or id. */
  from: string | string[];
  /** The category to keep, by name or id. */
  into: string;
}

export interface PreservedCategoryTag {
  category: CategoryRef;
  /**
   * The tag that now identifies the source category's transactions. `id` is null on a dry run
   * for a tag that would be created.
   */
  tag: { id: string | null; name: string };
  /** false when the user already had an equivalent tag (by name or slug). */
  tagCreated: boolean;
  transactionsTagged: number;
}

export interface PreserveCategoryTagsResult {
  tags: PreservedCategoryTag[];
  transactionsTagged: number;
}

export interface CategoryRuleRef {
  id: string;
  name: string;
  /** The category this rule pointed at when it was found. */
  category: CategoryRef;
}

export interface RepointCategoryRulesResult {
  /** Rules that now file into the merge target, each with the category it used to name. */
  repointed: CategoryRuleRef[];
}

export interface MergeCategoryTransactionsResult {
  transactionsReassigned: number;
  removedCategories: CategoryRef[];
  /** Sources whose transactions are not all marked with their preserving tag. */
  untaggedSources: CategoryRef[];
  /** Rules that still name a source category. Non-empty means the merge refused to run. */
  blockedRules: CategoryRuleRef[];
}

export interface CategoryCurrencyTotal {
  currencyCode: string;
  beforeCents: number;
  afterCents: number;
}

export interface CategoryMergeSteps {
  preserveTags: PreserveCategoryTagsResult;
  repointRules: RepointCategoryRulesResult;
  merge: MergeCategoryTransactionsResult;
}

export interface MergeFinanceCategoriesResult {
  transactionsReassigned: number;
  category: CategoryRef | null;
  /** The first removed category, kept for callers that merged a single source. */
  removedCategory: CategoryRef | null;
  removedCategories: CategoryRef[];
  reason: FinanceCategoryMergeReason | null;
  /** Sources still carrying untagged transactions when the merge refused; empty otherwise. */
  untaggedSources: CategoryRef[];
  /** Rules still naming a source category when the merge refused; empty otherwise. */
  blockedRules: CategoryRuleRef[];
  steps: CategoryMergeSteps | null;
  currencyTotals: CategoryCurrencyTotal[];
  totalsUnchanged: boolean;
  dryRun?: boolean;
}

interface ResolvedMerge {
  sources: CategoryRef[];
  target: CategoryRef;
}

type ResolveMergeResult =
  | { merge: ResolvedMerge; reason: null }
  | { merge: null; reason: 'unknown_category' | 'protected_category' };

async function resolveMerge(
  userId: string,
  input: MergeCategoryInput,
): Promise<ResolveMergeResult> {
  const requested = Array.isArray(input.from) ? input.from : [input.from];

  const sources: CategoryRef[] = [];
  for (const nameOrId of requested) {
    const source = await resolveFinanceCategory(userId, nameOrId);
    if (!source) return { merge: null, reason: 'unknown_category' };
    // Uncategorized is where unclassified rows collect; folding it away would rewrite the
    // whole fallback bucket, so it may only ever be a target. Checked before the target so a
    // merge out of Uncategorized is refused even when the target is gone.
    if (source.name.toLowerCase() === UNCATEGORIZED_NAME.toLowerCase()) {
      return { merge: null, reason: 'protected_category' };
    }
    sources.push(source);
  }

  const target = await resolveFinanceCategory(userId, input.into);
  if (!target) return { merge: null, reason: 'unknown_category' };

  return {
    merge: {
      sources: sources
        .filter((source, index) => sources.findIndex((entry) => entry.id === source.id) === index)
        .filter((source) => source.id !== target.id),
      target,
    },
    reason: null,
  };
}

/** The slug app.tags derives from a category name, so "equivalent tag" means the same thing. */
function tagSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function findEquivalentTag(
  executor: DbHandle,
  userId: string,
  name: string,
): Promise<CategoryRef | null> {
  const row = await executor
    .selectFrom('app.tags')
    .select(['id', 'name'])
    .where('ownerUserid', '=', userId)
    .where(sql<boolean>`(lower(name) = lower(${name}) or slug = ${tagSlug(name)})`)
    .limit(1)
    .executeTakeFirst();
  return row ?? null;
}

async function countTransactionsMarked(
  executor: DbHandle,
  userId: string,
  categoryId: string,
  tagId: string,
): Promise<number> {
  const row = await executor
    .selectFrom('app.financeTransactions as t')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('t.userId', '=', userId)
    .where('t.categoryId', '=', categoryId)
    .where(
      sql<boolean>`not exists (
        select 1
        from app.tag_assignments ti
        where ti.tag_id = ${tagId}
          and ti.entity_table = ${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass
          and ti.entity_id = t.id
          and ti.removed_at is null
      )`,
    )
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

function emptyPreserve(): PreserveCategoryTagsResult {
  return { tags: [], transactionsTagged: 0 };
}

async function preserveWith(
  executor: DbHandle,
  userId: string,
  sources: CategoryRef[],
  options: { dryRun: boolean },
): Promise<PreserveCategoryTagsResult> {
  const tags: PreservedCategoryTag[] = [];
  let transactionsTagged = 0;

  for (const source of sources) {
    const existing = await findEquivalentTag(executor, userId, source.name);
    if (options.dryRun) {
      const tag = existing ?? { id: null, name: source.name };
      const wouldMark = existing
        ? await countTransactionsMarked(executor, userId, source.id, existing.id)
        : await countCategoryTransactions(executor, userId, source.id);
      tags.push({ category: source, tag, tagCreated: !existing, transactionsTagged: wouldMark });
      transactionsTagged += wouldMark;
      continue;
    }

    const tagId = (await ensureTagIds(userId, [source.name], executor))[0];
    if (!tagId) throw new ValidationError('tag_create_failed', { category: source });
    const inserted = await sql<{ id: string }>`
      INSERT INTO app.tag_assignments (tag_id, entity_table, entity_id, assignment_source)
      SELECT ${tagId}, ${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass, t.id, 'merge'
      FROM app.finance_transactions t
      WHERE t.user_id = ${userId}
        AND t.category_id = ${source.id}
      ON CONFLICT (tag_id, entity_table, entity_id) WHERE removed_at IS NULL DO NOTHING
      RETURNING id
    `.execute(executor);

    const refreshed = await executor
      .selectFrom('app.tags')
      .select(['id', 'name'])
      .where('id', '=', tagId)
      .executeTakeFirstOrThrow();
    tags.push({
      category: source,
      tag: refreshed,
      tagCreated: !existing,
      transactionsTagged: inserted.rows.length,
    });
    transactionsTagged += inserted.rows.length;
  }

  return { tags, transactionsTagged };
}

async function countCategoryTransactions(
  executor: DbHandle,
  userId: string,
  categoryId: string,
): Promise<number> {
  const row = await executor
    .selectFrom('app.financeTransactions')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('userId', '=', userId)
    .where('categoryId', '=', categoryId)
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

async function findRulesReferencing(
  executor: DbHandle,
  userId: string,
  categoryIds: string[],
): Promise<CategoryRuleRef[]> {
  if (categoryIds.length === 0) return [];
  const rows = await executor
    .selectFrom('app.financeRules as r')
    .innerJoin('app.financeCategories as c', 'c.id', 'r.actionCategoryId')
    .select(['r.id as id', 'r.name as name', 'c.id as categoryId', 'c.name as categoryName'])
    .where('r.userId', '=', userId)
    .where('r.actionCategoryId', 'in', categoryIds)
    .orderBy('r.name', 'asc')
    .execute();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: { id: row.categoryId, name: row.categoryName },
  }));
}

async function repointWith(
  executor: DbHandle,
  userId: string,
  sources: CategoryRef[],
  target: CategoryRef,
  options?: { dryRun?: boolean },
): Promise<RepointCategoryRulesResult> {
  const repointed = await findRulesReferencing(
    executor,
    userId,
    sources.map((source) => source.id),
  );
  if (repointed.length === 0) return { repointed: [] };
  if (options?.dryRun) return { repointed };

  await executor
    .updateTable('app.financeRules')
    .set({ actionCategoryId: target.id })
    .where('userId', '=', userId)
    .where(
      'id',
      'in',
      repointed.map((rule) => rule.id),
    )
    .execute();

  return { repointed };
}

async function categoryCurrencyTotals(
  executor: DbHandle,
  userId: string,
  categoryIds: string[],
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (categoryIds.length === 0) return totals;
  const rows = await executor
    .selectFrom('app.financeTransactions')
    .select(['currencyCode'])
    .select((eb) => eb.fn.sum<number>('amount').as('total'))
    .where('userId', '=', userId)
    .where('categoryId', 'in', categoryIds)
    .groupBy('currencyCode')
    .orderBy('currencyCode', 'asc')
    .execute();
  for (const row of rows) totals.set(row.currencyCode, toCents(row.total));
  return totals;
}

/**
 * Stage 3 — the merge. Before moving a single row it re-scans rule references: a rule that still
 * names a source blocks the merge, and the caller gets the offending rules back by name. That
 * scan is what makes skipping the stages impossible — a merge attempted without repointing is
 * refused, never silently performed.
 *
 * Per-currency totals over the affected categories are captured before and after, and a mismatch
 * rolls the whole thing back: a merge may change classification, never the money.
 */
export async function mergeCategoryTransactions(
  userId: string,
  input: MergeCategoryInput,
): Promise<{
  result: MergeCategoryTransactionsResult;
  currencyTotals: CategoryCurrencyTotal[];
  totalsUnchanged: boolean;
  reason: FinanceCategoryMergeReason | null;
}> {
  const resolved = await resolveMerge(userId, input);
  if (!resolved.merge) {
    return {
      result: emptyMerge(),
      currencyTotals: [],
      totalsUnchanged: true,
      reason: resolved.reason,
    };
  }
  const { sources, target } = resolved.merge;
  return db.transaction().execute((trx) => mergeWith(trx, userId, sources, target));
}

function emptyMerge(): MergeCategoryTransactionsResult {
  return {
    transactionsReassigned: 0,
    removedCategories: [],
    untaggedSources: [],
    blockedRules: [],
  };
}

/** Sources whose transactions are not all marked with the tag that would identify them. */
async function findUntaggedSources(
  executor: DbHandle,
  userId: string,
  sources: CategoryRef[],
): Promise<CategoryRef[]> {
  const untagged: CategoryRef[] = [];
  for (const source of sources) {
    const tag = await findEquivalentTag(executor, userId, source.name);
    if (!tag) {
      untagged.push(source);
      continue;
    }
    if ((await countTransactionsMarked(executor, userId, source.id, tag.id)) > 0) {
      untagged.push(source);
    }
  }
  return untagged;
}

async function mergeWith(
  executor: DbHandle,
  userId: string,
  sources: CategoryRef[],
  target: CategoryRef,
): Promise<{
  result: MergeCategoryTransactionsResult;
  currencyTotals: CategoryCurrencyTotal[];
  totalsUnchanged: boolean;
  reason: FinanceCategoryMergeReason | null;
}> {
  const sourceIds = sources.map((source) => source.id);
  if (sourceIds.length === 0) {
    return {
      result: emptyMerge(),
      currencyTotals: [],
      totalsUnchanged: true,
      reason: null,
    };
  }

  // Stage 1 first: a source that is not fully tagged cannot be drill-downed after the merge, so
  // the merge refuses rather than losing which transactions came from where.
  const untaggedSources = await findUntaggedSources(executor, userId, sources);
  if (untaggedSources.length > 0) {
    return {
      result: { ...emptyMerge(), untaggedSources },
      currencyTotals: [],
      totalsUnchanged: true,
      reason: 'untagged_sources',
    };
  }

  // Stage 2: an automation that still names a source would recreate it on the next import.
  const blockedRules = await findRulesReferencing(executor, userId, sourceIds);
  if (blockedRules.length > 0) {
    return {
      result: { ...emptyMerge(), blockedRules },
      currencyTotals: [],
      totalsUnchanged: true,
      reason: 'unrepointed_rules',
    };
  }

  const affectedIds = [...sourceIds, target.id];
  const before = await categoryCurrencyTotals(executor, userId, affectedIds);

  const reassigned = await executor
    .updateTable('app.financeTransactions')
    .set({ categoryId: target.id })
    .where('userId', '=', userId)
    .where('categoryId', 'in', sourceIds)
    .executeTakeFirst();

  const removedCategories = await executor
    .deleteFrom('app.financeCategories')
    .where('userId', '=', userId)
    .where('id', 'in', sourceIds)
    .returning(['id', 'name'])
    .execute();

  const after = await categoryCurrencyTotals(executor, userId, [target.id]);
  const currencyTotals = [...before.keys()].sort().map((currencyCode) => ({
    currencyCode,
    beforeCents: before.get(currencyCode) ?? 0,
    afterCents: after.get(currencyCode) ?? 0,
  }));
  const totalsUnchanged = currencyTotals.every((total) => total.beforeCents === total.afterCents);
  if (!totalsUnchanged) {
    throw new ValidationError('merge_totals_mismatch', { category: target, currencyTotals });
  }

  return {
    result: {
      transactionsReassigned: Number(reassigned.numUpdatedRows),
      removedCategories,
      untaggedSources: [],
      blockedRules: [],
    },
    currencyTotals,
    totalsUnchanged,
    reason: null,
  };
}

/**
 * The safe category merge: preserve tags → repoint rules → merge, in one transaction and in that
 * order. `dryRun` reports all three stages without writing. `stage` runs one stage at a time for a
 * caller that needs to drive and inspect the ordering; the merge stage re-checks both earlier
 * stages, so a skipped one is refused with the offending categories or rules named.
 */
export async function mergeFinanceCategories(
  userId: string,
  input: MergeCategoryInput,
  options?: { dryRun?: boolean; stage?: CategoryMergeStage },
): Promise<MergeFinanceCategoriesResult> {
  const resolved = await resolveMerge(userId, input);
  if (!resolved.merge) {
    return {
      transactionsReassigned: 0,
      category: null,
      removedCategory: null,
      removedCategories: [],
      reason: resolved.reason,
      untaggedSources: [],
      blockedRules: [],
      steps: null,
      currencyTotals: [],
      totalsUnchanged: true,
    };
  }

  const { sources, target } = resolved.merge;
  if (sources.length === 0) {
    return {
      transactionsReassigned: 0,
      category: target,
      removedCategory: null,
      removedCategories: [],
      reason: null,
      untaggedSources: [],
      blockedRules: [],
      steps: null,
      currencyTotals: [],
      totalsUnchanged: true,
    };
  }

  const stage = options?.stage ?? 'all';

  if (options?.dryRun) {
    const preserveTags = await preserveWith(db, userId, sources, { dryRun: true });
    const repointRules = await repointWith(db, userId, sources, target, { dryRun: true });
    const wouldMove = await countCategoryTransactionsFor(db, userId, sources);
    // The affected set is unchanged by the merge — only the rows' category_id moves — so the
    // projected totals are the current totals for that set.
    const before = await categoryCurrencyTotals(db, userId, [
      ...sources.map((source) => source.id),
      target.id,
    ]);
    return {
      transactionsReassigned: wouldMove,
      category: target,
      removedCategory: null,
      removedCategories: [],
      reason: null,
      untaggedSources: [],
      blockedRules: [],
      steps: {
        preserveTags,
        repointRules: { repointed: repointRules.repointed },
        merge: {
          transactionsReassigned: wouldMove,
          removedCategories: [],
          untaggedSources: [],
          blockedRules: [],
        },
      },
      currencyTotals: [...before.entries()].map(([currencyCode, cents]) => ({
        currencyCode,
        beforeCents: cents,
        afterCents: cents,
      })),
      totalsUnchanged: true,
      dryRun: true,
    };
  }

  return db.transaction().execute(async (trx) => {
    // Ordered on purpose: the guarantees only hold in this sequence.
    const preserveTags =
      stage === 'all' || stage === 'preserve'
        ? await preserveWith(trx, userId, sources, { dryRun: false })
        : emptyPreserve();
    const repointRules =
      stage === 'all' || stage === 'repoint'
        ? await repointWith(trx, userId, sources, target)
        : { repointed: [] };
    const merge =
      stage === 'all' || stage === 'merge'
        ? await mergeWith(trx, userId, sources, target)
        : {
            result: emptyMerge(),
            currencyTotals: [],
            totalsUnchanged: true,
            reason: null,
          };

    return {
      transactionsReassigned: merge.result.transactionsReassigned,
      category: target,
      removedCategory: merge.result.removedCategories[0] ?? null,
      removedCategories: merge.result.removedCategories,
      reason: merge.reason,
      untaggedSources: merge.result.untaggedSources,
      blockedRules: merge.result.blockedRules,
      steps: { preserveTags, repointRules, merge: merge.result },
      currencyTotals: merge.currencyTotals,
      totalsUnchanged: merge.totalsUnchanged,
    };
  });
}

async function countCategoryTransactionsFor(
  executor: DbHandle,
  userId: string,
  sources: CategoryRef[],
): Promise<number> {
  let total = 0;
  for (const source of sources) {
    total += await countCategoryTransactions(executor, userId, source.id);
  }
  return total;
}

export interface CategoryTagBreakdownRow {
  /** null is the untagged bucket. */
  tagId: string | null;
  tagName: string;
  currencyCode: string;
  spentCents: number;
  transactionCount: number;
}

export interface CategoryTagBreakdown {
  category: CategoryRef;
  from: string;
  to: string;
  /** Set only when every matched transaction is in one currency. */
  currencyCode: string | null;
  tags: CategoryTagBreakdownRow[];
  /** The category's true totals per currency, which tag buckets can exceed when tags overlap. */
  totals: Array<{ currencyCode: string; spentCents: number; transactionCount: number }>;
  warnings: string[];
}

function fallbackDate(daysAgo: number, now: Date): string {
  return new Date(now.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Drill-down: one category's spending grouped by tag, so the components a merge folded together
 * can still be filtered and totalled. Spending filters match `getFinanceSpendingByCategory` so a
 * tag bucket is comparable with the category total.
 */
export async function getCategoryTagBreakdown(
  userId: string,
  input: { category: string; from?: string; to?: string; limit?: number },
): Promise<CategoryTagBreakdown | null> {
  const category = await resolveFinanceCategory(userId, input.category);
  if (!category) return null;

  const now = new Date();
  const from = input.from ?? fallbackDate(30, now);
  const to = input.to ?? now.toISOString().slice(0, 10);
  const limit = input.limit ?? 50;

  const rowsQuery = db
    .selectFrom('app.financeTransactions as t')
    .leftJoin('app.tagAssignments as ti', (join) =>
      join
        .onRef('ti.entityId', '=', 't.id')
        .on('ti.entityTable', '=', sql`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`)
        .on('ti.removedAt', 'is', null),
    )
    .leftJoin('app.tags as tg', (join) =>
      join.onRef('tg.id', '=', 'ti.tagId').on('tg.ownerUserid', '=', userId),
    )
    .select((eb) => [
      'tg.id as tagId',
      'tg.name as tagName',
      't.currencyCode as currencyCode',
      eb.fn.sum<number>(sql`abs(t.amount)`).as('spent'),
      eb.fn.count<number>('t.id').as('transactionCount'),
    ])
    .where('t.userId', '=', userId)
    .where('t.categoryId', '=', category.id)
    .where('t.pending', '=', false)
    .where('t.excluded', '=', false)
    .where('t.transactionType', '!=', 'transfer')
    .where(sql<boolean>`t.amount < 0`)
    .where('t.postedOn', '>=', from)
    .where('t.postedOn', '<=', to)
    .groupBy(['tg.id', 'tg.name', 't.currencyCode'])
    .orderBy('spent', 'desc')
    .orderBy('tagName', 'asc')
    .limit(limit + 1);

  const rows = await rowsQuery.execute();
  const truncated = rows.length > limit;

  const totals = await db
    .selectFrom('app.financeTransactions')
    .select((eb) => [
      'currencyCode',
      eb.fn.sum<number>(sql`abs(amount)`).as('spent'),
      eb.fn.count<number>('id').as('transactionCount'),
    ])
    .where('userId', '=', userId)
    .where('categoryId', '=', category.id)
    .where('pending', '=', false)
    .where('excluded', '=', false)
    .where('transactionType', '!=', 'transfer')
    .where(sql<boolean>`amount < 0`)
    .where('postedOn', '>=', from)
    .where('postedOn', '<=', to)
    .groupBy('currencyCode')
    .orderBy('currencyCode', 'asc')
    .execute();

  const currencies = totals.map((row) => row.currencyCode);
  const overlap = await db
    .selectFrom('app.financeTransactions as t')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('t.userId', '=', userId)
    .where('t.categoryId', '=', category.id)
    .where('t.pending', '=', false)
    .where('t.excluded', '=', false)
    .where('t.transactionType', '!=', 'transfer')
    .where(sql<boolean>`t.amount < 0`)
    .where('t.postedOn', '>=', from)
    .where('t.postedOn', '<=', to)
    .where(
      sql<boolean>`(
        select count(*)
        from app.tag_assignments ti_multi
        join app.tags tg_multi
          on tg_multi.id = ti_multi.tag_id
         and tg_multi.owner_userid = ${userId}
        where ti_multi.entity_table = ${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass
          and ti_multi.entity_id = t.id
          and ti_multi.removed_at is null
      ) > 1`,
    )
    .executeTakeFirst();
  const overlapping = Number(overlap?.count ?? 0);

  return {
    category,
    from,
    to,
    currencyCode: currencies.length === 1 ? (currencies[0] ?? null) : null,
    tags: rows.slice(0, limit).map((row) => ({
      tagId: row.tagId,
      tagName: row.tagName ?? '(untagged)',
      currencyCode: row.currencyCode,
      spentCents: toCents(toNumber(row.spent)),
      transactionCount: Number(row.transactionCount),
    })),
    totals: totals.map((row) => ({
      currencyCode: row.currencyCode,
      spentCents: toCents(toNumber(row.spent)),
      transactionCount: Number(row.transactionCount),
    })),
    warnings: [
      ...(currencies.length > 1
        ? ['Spending spans multiple currencies; tag buckets are reported separately by currency.']
        : []),
      ...(overlapping > 0
        ? [
            `${overlapping} transaction(s) carry more than one tag, so tag buckets overlap and can exceed the category total.`,
          ]
        : []),
      ...(truncated ? [`Tag results are truncated at the requested limit (${limit}).`] : []),
    ],
  };
}
