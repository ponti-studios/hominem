import { db, sql } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';
import {
  FINANCE_TRANSACTION_ENTITY_TYPE,
  getMonthlyStatsByContract,
  getTopMerchantsByContract,
  getTransactionTagNames,
  importSheetTransactions,
  listFinanceCategories,
  toSheetRejectionReason,
  upsertSheetTransaction,
  type SheetTransactionInput,
} from '@hominem/finance-services';

export type { SheetTransactionInput };

export interface FinanceReportFilter {
  from?: string | undefined;
  to?: string | undefined;
  accountId?: string | undefined;
  /** A tag id (UUID) or a tag name. */
  tag?: string | undefined;
  limit?: number | undefined;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function toCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function toContractFilter(filter: FinanceReportFilter) {
  return {
    ...(filter.accountId ? { accountId: filter.accountId } : {}),
    ...(filter.from ? { dateFrom: filter.from } : {}),
    ...(filter.to ? { dateTo: filter.to } : {}),
    ...(filter.tag
      ? isUuid(filter.tag)
        ? { tagIds: [filter.tag] }
        : { tagNames: [filter.tag] }
      : {}),
  };
}

export async function getTagBreakdownReport(userId: string, filter: FinanceReportFilter) {
  let query = db
    .selectFrom('app.financeTransactions as t')
    .leftJoin('app.tagAssignments as ta', (join) =>
      join
        .onRef('ta.entityId', '=', 't.id')
        .on('ta.removedAt', 'is', null)
        .on('ta.entityTable', '=', sql`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`),
    )
    .leftJoin('app.tags as tg', (join) =>
      join.onRef('tg.id', '=', 'ta.tagId').on('tg.ownerUserid', '=', userId),
    )
    .select((eb) => [
      eb.fn.coalesce('tg.name', sql<string>`'(untagged)'`).as('tag'),
      't.currencyCode as currencyCode',
      eb.fn.sum<number>(sql`abs(t.amount)`).as('amount'),
      eb.fn.countAll<number>().as('transactionCount'),
      eb.fn.min('t.postedOn').as('firstPostedOn'),
      eb.fn.max('t.postedOn').as('lastPostedOn'),
    ])
    .where('t.userId', '=', userId)
    .where('t.excluded', '=', false)
    .where('t.pending', '=', false)
    .where(sql<boolean>`t.amount < 0`);
  if (filter.accountId) query = query.where('t.accountId', '=', filter.accountId);
  if (filter.from) query = query.where('t.postedOn', '>=', filter.from);
  if (filter.to) query = query.where('t.postedOn', '<=', filter.to);
  if (filter.tag) {
    query = query.where((eb) =>
      eb.exists(
        eb
          .selectFrom('app.tagAssignments as filterTa')
          .innerJoin('app.tags as filterTag', 'filterTag.id', 'filterTa.tagId')
          .select('filterTa.entityId')
          .whereRef('filterTa.entityId', '=', 't.id')
          .where('filterTa.removedAt', 'is', null)
          .where(
            sql<boolean>`filter_ta.entity_table = ${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`,
          )
          .where('filterTag.ownerUserid', '=', userId)
          .where((eb2) =>
            isUuid(filter.tag!)
              ? eb2('filterTag.id', '=', filter.tag!)
              : eb2('filterTag.name', '=', filter.tag!),
          ),
      ),
    );
  }
  let totalsQuery = db
    .selectFrom('app.financeTransactions as t')
    .select((eb) => [
      't.currencyCode as currencyCode',
      eb.fn.sum<number>(sql`abs(t.amount)`).as('amount'),
      eb.fn.min('t.postedOn').as('firstPostedOn'),
      eb.fn.max('t.postedOn').as('lastPostedOn'),
    ])
    .where('t.userId', '=', userId)
    .where('t.excluded', '=', false)
    .where('t.pending', '=', false)
    .where(sql<boolean>`t.amount < 0`);
  if (filter.accountId) totalsQuery = totalsQuery.where('t.accountId', '=', filter.accountId);
  if (filter.from) totalsQuery = totalsQuery.where('t.postedOn', '>=', filter.from);
  if (filter.to) totalsQuery = totalsQuery.where('t.postedOn', '<=', filter.to);
  if (filter.tag) {
    totalsQuery = totalsQuery.where((eb) =>
      eb.exists(
        eb
          .selectFrom('app.tagAssignments as filterTa')
          .innerJoin('app.tags as filterTag', 'filterTag.id', 'filterTa.tagId')
          .select('filterTa.entityId')
          .whereRef('filterTa.entityId', '=', 't.id')
          .where('filterTa.removedAt', 'is', null)
          .where(
            sql<boolean>`filter_ta.entity_table = ${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`,
          )
          .where('filterTag.ownerUserid', '=', userId)
          .where((eb2) =>
            isUuid(filter.tag!)
              ? eb2('filterTag.id', '=', filter.tag!)
              : eb2('filterTag.name', '=', filter.tag!),
          ),
      ),
    );
  }
  const totals = await totalsQuery.groupBy('t.currencyCode').execute();
  const rows = await query
    .groupBy(['tg.name', 't.currencyCode'])
    .orderBy('amount', 'desc')
    .orderBy('tag', 'asc')
    .execute();

  const breakdownByCurrency = new Map<
    string,
    Array<{ tag: string; amount: number; transactionCount: number }>
  >();
  let firstPostedOn: Date | null = null;
  let lastPostedOn: Date | null = null;
  for (const row of rows) {
    const items = breakdownByCurrency.get(row.currencyCode) ?? [];
    items.push({
      tag: row.tag,
      amount: Number(row.amount),
      transactionCount: Number(row.transactionCount),
    });
    breakdownByCurrency.set(row.currencyCode, items);
    if (row.firstPostedOn) {
      const date = new Date(row.firstPostedOn);
      if (!firstPostedOn || date < firstPostedOn) firstPostedOn = date;
    }
    if (row.lastPostedOn) {
      const date = new Date(row.lastPostedOn);
      if (!lastPostedOn || date > lastPostedOn) lastPostedOn = date;
    }
  }
  const totalsByCurrency = totals.map((row) => ({
    currencyCode: row.currencyCode,
    totalSpending: Number(row.amount),
  }));
  const limit = Math.max(1, Math.floor(filter.limit ?? 5));
  const rankedByCurrency = [...breakdownByCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([currencyCode, items]) => {
      const currencyTotal =
        totalsByCurrency.find((item) => item.currencyCode === currencyCode)?.totalSpending ?? 0;
      return items
        .sort((a, b) => b.amount - a.amount || a.tag.localeCompare(b.tag))
        .map((item) => ({
          ...item,
          currencyCode,
          percentage: currencyTotal === 0 ? 0 : (item.amount / currencyTotal) * 100,
        }));
    });
  const breakdown: typeof rankedByCurrency = [];
  const currencyCodes = [...breakdownByCurrency.keys()].sort((a, b) => a.localeCompare(b));
  for (let rank = 0; breakdown.length < limit; rank += 1) {
    let found = false;
    for (const currencyCode of currencyCodes) {
      const currencyItems = rankedByCurrency.filter((row) => row.currencyCode === currencyCode);
      const next = currencyItems[rank];
      if (!next) continue;
      found = true;
      breakdown.push(next);
      if (breakdown.length === limit) break;
    }
    if (!found) break;
  }

  const fromDate = filter.from ? new Date(filter.from) : firstPostedOn;
  const toDate = filter.to ? new Date(filter.to) : lastPostedOn;
  const daySpan =
    fromDate && toDate
      ? Math.max(1, Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
      : 1;
  const totalsByCurrencyWithDailyAverage = totalsByCurrency.map((item) => ({
    ...item,
    averagePerDay: item.totalSpending / daySpan,
  }));
  const totalSpending =
    totalsByCurrency.length > 1 ? null : (totalsByCurrency[0]?.totalSpending ?? 0);

  const currencyCode =
    totalsByCurrency.length === 1 ? (totalsByCurrency[0]?.currencyCode ?? null) : null;
  const warnings =
    totalsByCurrency.length > 1
      ? ['Spending spans multiple currencies; totals are reported separately by currency.']
      : [];
  return {
    breakdown,
    totalSpending,
    totalsByCurrency: totalsByCurrencyWithDailyAverage,
    averagePerDay: totalSpending === null ? null : totalSpending / daySpan,
    currencyCode,
    warnings,
  };
}

export async function getTopMerchantsReport(userId: string, filter: FinanceReportFilter) {
  const { merchants, currencyCode, warnings } = await getTopMerchantsByContract({
    userId,
    ...toContractFilter(filter),
    limit: filter.limit ? Math.max(1, Math.floor(filter.limit)) : 10,
  });
  return { merchants, currencyCode, warnings };
}

export async function getMonthlyStatsReport(userId: string, month?: string) {
  const monthly = await getMonthlyStatsByContract({
    userId,
    ...(month ? { month } : {}),
  });

  return {
    month: monthly.month,
    income: monthly.income,
    expenses: monthly.expenses,
    net: monthly.net,
    transactionCount: monthly.transactionCount,
    averageTransaction: monthly.averageTransaction,
    topTag: monthly.topTag,
    topMerchant: monthly.topMerchant,
    formattedIncome: monthly.income === null ? null : toCurrency(monthly.income),
    formattedExpenses: monthly.expenses === null ? null : toCurrency(monthly.expenses),
    formattedNet: monthly.net === null ? null : toCurrency(monthly.net),
    formattedAverage:
      monthly.averageTransaction === null ? null : toCurrency(monthly.averageTransaction),
    totalIncome: monthly.income,
    totalExpenses: monthly.expenses,
    netIncome: monthly.net,
    tagSpending: monthly.tagSpending,
    currencyBreakdown: monthly.currencyBreakdown,
    ...(monthly.startDate ? { startDate: monthly.startDate } : {}),
    ...(monthly.endDate ? { endDate: monthly.endDate } : {}),
    currencyCode: monthly.currencyCode,
    warnings: monthly.warnings,
  };
}

export interface TransactionSearchInput {
  accountIds?: string[] | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  /** Case-insensitive match against description and merchant name. */
  text?: string | undefined;
  tagIds?: string[] | undefined;
  tagNames?: string[] | undefined;
  categoryName?: string | undefined;
  transactionType?: string | undefined;
  limit: number;
  offset: number;
}

export async function searchTransactions(userId: string, input: TransactionSearchInput) {
  const accountIds = input.accountIds ?? [];
  const tagIds = input.tagIds ?? [];
  const tagNames = input.tagNames ?? [];

  const filterableBase = () =>
    db
      .selectFrom('app.financeTransactions as t')
      .innerJoin('app.financeAccounts as a', 'a.id', 't.accountId')
      .leftJoin('app.financeCategories as c', 'c.id', 't.categoryId')
      .where('t.userId', '=', userId);

  const applyFilters = (query: ReturnType<typeof filterableBase>) => {
    let filtered = query;
    if (accountIds.length > 0) filtered = filtered.where('t.accountId', 'in', accountIds);
    if (input.dateFrom) filtered = filtered.where('t.postedOn', '>=', input.dateFrom);
    if (input.dateTo) filtered = filtered.where('t.postedOn', '<=', input.dateTo);
    if (input.categoryName)
      filtered = filtered.where(sql`lower(c.name)`, '=', input.categoryName.toLowerCase());
    if (input.transactionType)
      filtered = filtered.where('t.transactionType', '=', input.transactionType);
    if (input.text) {
      const term = `%${input.text}%`;
      filtered = filtered.where((eb) =>
        eb.or([eb('t.description', 'ilike', term), eb('t.merchantName', 'ilike', term)]),
      );
    }
    // A correlated EXISTS subquery (rather than materializing every matching transaction id
    // in memory and passing it through a WHERE id IN (...) clause) so tag filtering stays a
    // single indexed lookup per row regardless of how many transactions carry the tag.
    if (tagIds.length > 0 || tagNames.length > 0) {
      filtered = filtered.where((eb) =>
        eb.exists(
          eb
            .selectFrom('app.tagAssignments')
            .innerJoin('app.tags', 'app.tags.id', 'app.tagAssignments.tagId')
            .select('app.tagAssignments.entityId')
            .where(
              'app.tagAssignments.entityTable',
              '=',
              sql<string>`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`,
            )
            .where('app.tagAssignments.entityId', '=', eb.ref('t.id'))
            .where('app.tags.ownerUserid', '=', userId)
            .where((eb2) => {
              const conditions = [];
              if (tagIds.length > 0) conditions.push(eb2('app.tagAssignments.tagId', 'in', tagIds));
              if (tagNames.length > 0) conditions.push(eb2('app.tags.name', 'in', tagNames));
              return eb2.or(conditions);
            }),
        ),
      );
    }
    return filtered;
  };

  const [rows, filteredRow, totalRow] = await Promise.all([
    applyFilters(filterableBase())
      .select([
        't.id',
        't.userId',
        't.accountId',
        'a.name as accountName',
        't.amount',
        't.description',
        't.merchantName',
        't.postedOn',
        't.currencyCode',
        't.transactionType',
        't.categoryId',
        'c.name as categoryName',
        't.notes',
        't.orderNumber',
        't.counterpartId',
        't.source',
        't.externalId',
        't.recurring',
        't.pending',
        't.excluded',
      ])
      .orderBy('t.postedOn', 'desc')
      .orderBy('t.id', 'desc')
      .limit(input.limit)
      .offset(input.offset)
      .execute(),
    applyFilters(filterableBase()).select(db.fn.countAll<number>().as('count')).executeTakeFirst(),
    db
      .selectFrom('app.financeTransactions')
      .select(db.fn.countAll<number>().as('count'))
      .where('userId', '=', userId)
      .executeTakeFirst(),
  ]);

  const tagNamesById = await getTransactionTagNames(
    userId,
    rows.map((row) => row.id),
  );

  return {
    data: rows.map((t) => ({
      id: t.id,
      userId: t.userId,
      accountId: t.accountId,
      accountName: t.accountName,
      amount: t.amount ? Number(t.amount) : 0,
      description: t.description ?? null,
      merchantName: t.merchantName ?? null,
      postedOn: t.postedOn ? String(t.postedOn) : '',
      currencyCode: t.currencyCode,
      transactionType: t.transactionType,
      categoryId: t.categoryId ?? null,
      categoryName: t.categoryName ?? null,
      tags: tagNamesById.get(t.id) ?? [],
      notes: t.notes ?? null,
      orderNumber: t.orderNumber,
      counterpartId: t.counterpartId ?? null,
      source: t.source,
      externalId: t.externalId,
      recurring: t.recurring === true,
      pending: t.pending === true,
      excluded: t.excluded === true,
    })),
    filteredCount: Number(filteredRow?.count ?? 0),
    totalUserCount: Number(totalRow?.count ?? 0),
  };
}

// ── Sheet mirror import (finance_transaction_upsert / finance_transactions_import) ──

export async function upsertFinanceTransaction(
  ownerUserId: string,
  input: SheetTransactionInput & {
    accountMap?: Record<string, string>;
  },
) {
  const { accountMap, ...row } = input;
  try {
    const result = await upsertSheetTransaction(ownerUserId, row, accountMap);
    return { id: result.id, created: result.created, accountId: result.accountId, reason: null };
  } catch (error) {
    // A row-level rejection (unknown account, currency mismatch, invalid row) is ordinary
    // data, not a server fault — return it structured, the same shape the batch import's
    // per-row results use, instead of an opaque MCP failure.
    const reason = toSheetRejectionReason(error);
    if (!reason) throw error;
    return { id: null, created: false, accountId: null, reason };
  }
}

export async function importFinanceTransactions(
  ownerUserId: string,
  options: {
    transactions: SheetTransactionInput[];
    mode?: 'append' | 'replace';
    dryRun?: boolean;
    accountMap?: Record<string, string>;
    iUnderstand?: boolean;
  },
) {
  return importSheetTransactions(ownerUserId, options);
}

export async function moveFinanceTransactions(
  ownerUserId: string,
  ids: string[],
  toAccount: string,
) {
  const account = await db
    .selectFrom('app.financeAccounts')
    .select(['id', 'currencyCode', 'allowedCurrencies'])
    .where('id', '=', toAccount)
    .where('userId', '=', ownerUserId)
    .executeTakeFirst();
  if (!account) throw new ValidationError('unknown_account');
  const rows = await db
    .selectFrom('app.financeTransactions')
    .select(['id', 'currencyCode', 'counterpartId', 'accountId'])
    .where('userId', '=', ownerUserId)
    .where('id', 'in', ids)
    .execute();
  const foundIds = new Set(rows.map((row) => row.id));
  const notFound = [...new Set(ids)].filter((id) => !foundIds.has(id));
  if (notFound.length > 0) {
    return { moved: [], count: 0, accountId: account.id, notFound };
  }
  const allowed = new Set(
    [account.currencyCode, ...account.allowedCurrencies].map((code) => code.toUpperCase()),
  );
  if (rows.some((row) => !allowed.has(row.currencyCode.toUpperCase())))
    throw new ValidationError('currency_mismatch');
  const movedIds = new Set(ids);
  const counterpartIds = rows.flatMap((row) =>
    row.counterpartId && !movedIds.has(row.counterpartId) ? [row.counterpartId] : [],
  );
  const counterpartAccounts = counterpartIds.length
    ? await db
        .selectFrom('app.financeTransactions')
        .select(['id', 'accountId'])
        .where('userId', '=', ownerUserId)
        .where('id', 'in', counterpartIds)
        .execute()
    : [];
  const accountById = new Map(rows.map((row) => [row.id, account.id]));
  for (const row of counterpartAccounts) accountById.set(row.id, row.accountId);
  if (rows.some((row) => row.counterpartId && accountById.get(row.counterpartId) === account.id)) {
    throw new ValidationError('move_would_break_counterpart_accounts');
  }
  const moved = await db
    .updateTable('app.financeTransactions')
    .set({ accountId: account.id })
    .where('userId', '=', ownerUserId)
    .where('id', 'in', ids)
    .returning('id')
    .execute();
  return {
    moved: moved.map((row) => row.id),
    count: moved.length,
    accountId: account.id,
    notFound: [],
  };
}

export async function listFinanceCategoryOptions(ownerUserId: string) {
  const categories = await listFinanceCategories(ownerUserId);
  return { categories, count: categories.length };
}
