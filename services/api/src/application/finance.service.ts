import { db, sql } from '@hominem/db/core';
import {
  FINANCE_TRANSACTION_ENTITY_TYPE,
  getMonthlyStatsByContract,
  getTagBreakdownByContract,
  getTopMerchantsByContract,
} from '@hominem/finance-services';

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
  const breakdown = await getTagBreakdownByContract({
    userId,
    ...toContractFilter(filter),
    limit: filter.limit ?? 5,
  });
  const totalSpending = breakdown.reduce((sum, item) => sum + item.amount, 0);
  const fromDate = filter.from ? new Date(filter.from) : null;
  const toDate = filter.to ? new Date(filter.to) : null;
  const daySpan =
    fromDate && toDate
      ? Math.max(1, Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
      : 1;

  return {
    breakdown: breakdown.map((item) => ({
      tag: item.tag,
      amount: item.amount,
      percentage: totalSpending === 0 ? 0 : (item.amount / totalSpending) * 100,
      transactionCount: item.transactionCount,
    })),
    totalSpending,
    averagePerDay: totalSpending / daySpan,
  };
}

export async function getTopMerchantsReport(userId: string, filter: FinanceReportFilter) {
  const merchants = await getTopMerchantsByContract({
    userId,
    ...toContractFilter(filter),
    limit: filter.limit ? Math.max(1, Math.floor(filter.limit)) : 10,
  });
  return { merchants };
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

async function getTaggedTransactionIds(
  userId: string,
  tagIds: string[],
  tagNames: string[],
): Promise<string[]> {
  let query = db
    .selectFrom('app.tagAssignments')
    .innerJoin('app.tags', 'app.tagAssignments.tagId', 'app.tags.id')
    .select('app.tagAssignments.entityId')
    .where(
      'app.tagAssignments.entityTable',
      '=',
      sql<string>`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`,
    )
    .where('app.tags.ownerUserid', '=', userId);

  if (tagIds.length > 0 && tagNames.length > 0) {
    query = query.where((eb) =>
      eb.or([eb('app.tagAssignments.tagId', 'in', tagIds), eb('app.tags.name', 'in', tagNames)]),
    );
  } else if (tagIds.length > 0) {
    query = query.where('app.tagAssignments.tagId', 'in', tagIds);
  } else {
    query = query.where('app.tags.name', 'in', tagNames);
  }

  const rows = await query.execute();
  return [...new Set(rows.map((r) => r.entityId))];
}

export async function searchTransactions(userId: string, input: TransactionSearchInput) {
  const accountIds = input.accountIds ?? [];
  const tagIds = input.tagIds ?? [];
  const tagNames = input.tagNames ?? [];

  let taggedIds: string[] | null = null;
  if (tagIds.length > 0 || tagNames.length > 0) {
    taggedIds = await getTaggedTransactionIds(userId, tagIds, tagNames);
  }

  const filterableBase = () =>
    db.selectFrom('app.financeTransactions').where('userId', '=', userId);

  const applyFilters = (query: ReturnType<typeof filterableBase>) => {
    let filtered = query;
    if (accountIds.length > 0) filtered = filtered.where('accountId', 'in', accountIds);
    if (input.dateFrom) filtered = filtered.where('postedOn', '>=', input.dateFrom);
    if (input.dateTo) filtered = filtered.where('postedOn', '<=', input.dateTo);
    if (input.text) {
      const term = `%${input.text}%`;
      filtered = filtered.where((eb) =>
        eb.or([eb('description', 'ilike', term), eb('merchantName', 'ilike', term)]),
      );
    }
    if (taggedIds) filtered = filtered.where('id', 'in', taggedIds);
    return filtered;
  };

  const totalUserCountQuery = db
    .selectFrom('app.financeTransactions')
    .select(db.fn.countAll<number>().as('count'))
    .where('userId', '=', userId)
    .executeTakeFirst();

  if (taggedIds && taggedIds.length === 0) {
    return { data: [], filteredCount: 0, totalUserCount: 0 };
  }

  const [rows, filteredRow, totalRow] = await Promise.all([
    applyFilters(filterableBase())
      .selectAll()
      .orderBy('postedOn', 'desc')
      .orderBy('id', 'desc')
      .limit(input.limit)
      .offset(input.offset)
      .execute(),
    applyFilters(filterableBase()).select(db.fn.countAll<number>().as('count')).executeTakeFirst(),
    totalUserCountQuery,
  ]);

  return {
    data: rows.map((t) => ({
      id: t.id,
      userId: t.userId,
      accountId: t.accountId,
      amount: t.amount ? Number(t.amount) : 0,
      description: t.description ?? null,
      postedOn: t.postedOn ? String(t.postedOn) : '',
      merchantName: t.merchantName ?? null,
      pending: t.pending,
      excluded: t.excluded,
    })),
    filteredCount: Number(filteredRow?.count ?? 0),
    totalUserCount: Number(totalRow?.count ?? 0),
  };
}
