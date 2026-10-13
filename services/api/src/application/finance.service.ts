import { db, sql } from '@hominem/db/core';
import {
  FINANCE_TRANSACTION_ENTITY_TYPE,
  getMonthlyStatsByContract,
  getTopMerchantsByContract,
  getTransactionTagNames,
  importSheetTransactions,
  listFinanceCategories,
  queryAnalyticsTransactionsByContract,
  summarizeCurrencies,
  toSheetRejectionReason,
  upsertSheetTransaction,
  type SheetTransactionInput,
} from '@hominem/finance-services';

export type { SheetTransactionInput };

// queryAnalyticsTransactionsByContract's own cap; also the ceiling documented in REPORT_CAVEAT.
const MAX_ANALYTICS_TRANSACTIONS = 200;

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
  const transactions = await queryAnalyticsTransactionsByContract({
    userId,
    ...toContractFilter(filter),
    limit: MAX_ANALYTICS_TRANSACTIONS,
  });

  const breakdownByLabel = new Map<string, { amount: number; transactionCount: number }>();
  const spendingCurrencies: string[] = [];
  let minPostedOn: Date | null = null;
  let maxPostedOn: Date | null = null;
  for (const tx of transactions) {
    if (tx.postedOn) {
      const postedOn = new Date(tx.postedOn);
      if (!minPostedOn || postedOn < minPostedOn) minPostedOn = postedOn;
      if (!maxPostedOn || postedOn > maxPostedOn) maxPostedOn = postedOn;
    }
    if (tx.amount >= 0) continue;
    spendingCurrencies.push(tx.currencyCode);
    const current = breakdownByLabel.get(tx.classification) ?? { amount: 0, transactionCount: 0 };
    current.amount += Math.abs(tx.amount);
    current.transactionCount += 1;
    breakdownByLabel.set(tx.classification, current);
  }

  // Compute the total and day span over every matching tag before the display limit
  // truncates the breakdown, so totals and percentages account for all of them.
  const allBreakdown = [...breakdownByLabel.entries()]
    .map(([tag, value]) => ({
      tag,
      amount: value.amount,
      transactionCount: value.transactionCount,
    }))
    .sort((a, b) => b.amount - a.amount || a.tag.localeCompare(b.tag));
  const totalSpending = allBreakdown.reduce((sum, item) => sum + item.amount, 0);

  const fromDate = filter.from ? new Date(filter.from) : minPostedOn;
  const toDate = filter.to ? new Date(filter.to) : maxPostedOn;
  const daySpan =
    fromDate && toDate
      ? Math.max(1, Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
      : 1;

  const limit = Math.max(1, Math.floor(filter.limit ?? 5));
  const { currencyCode, warnings } = summarizeCurrencies(spendingCurrencies);
  return {
    breakdown: allBreakdown.slice(0, limit).map((item) => ({
      tag: item.tag,
      amount: item.amount,
      percentage: totalSpending === 0 ? 0 : (item.amount / totalSpending) * 100,
      transactionCount: item.transactionCount,
    })),
    totalSpending,
    averagePerDay: totalSpending / daySpan,
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
    formattedIncome: toCurrency(monthly.income),
    formattedExpenses: toCurrency(monthly.expenses),
    formattedNet: toCurrency(monthly.net),
    formattedAverage: toCurrency(monthly.averageTransaction),
    totalIncome: monthly.income,
    totalExpenses: monthly.expenses,
    netIncome: monthly.net,
    tagSpending: monthly.tagSpending,
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
        't.source',
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
      source: t.source,
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
    multiCurrencyAccounts?: string[];
  },
) {
  const { accountMap, multiCurrencyAccounts, ...row } = input;
  try {
    const result = await upsertSheetTransaction(ownerUserId, row, accountMap, {
      multiCurrencyAccounts,
    });
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
    multiCurrencyAccounts?: string[];
    iUnderstand?: boolean;
  },
) {
  return importSheetTransactions(ownerUserId, options);
}

export async function listFinanceCategoryOptions(ownerUserId: string) {
  const categories = await listFinanceCategories(ownerUserId);
  return { categories, count: categories.length };
}
