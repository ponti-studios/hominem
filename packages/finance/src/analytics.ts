import { db } from '@hominem/db/core';
import { sql } from 'kysely';

import { FINANCE_TRANSACTION_ENTITY_TYPE } from './contracts';
import { queryAnalyticsTransactionsByContract } from './transactions';
import { summarizeCurrencies, toNumber } from './utils';

async function getTagBreakdown(ownerId: string): Promise<Array<{ tag: string; total: number }>> {
  const result = await db
    .selectFrom('app.financeTransactions as t')
    .innerJoin('app.tagAssignments as ti', (join) =>
      join
        .onRef('ti.entityId', '=', 't.id')
        .on('ti.entityTable', '=', sql`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`),
    )
    .innerJoin('app.tags as tg', (join) =>
      join.onRef('tg.id', '=', 'ti.tagId').on('tg.ownerUserid', '=', ownerId),
    )
    .select((eb) => [
      eb.ref('tg.name').as('tag'),
      sql<number>`coalesce(sum(abs(amount)), 0)`.as('total'),
    ])
    .where('t.userId', '=', ownerId)
    .where('t.excluded', '=', false)
    .where('t.transactionType', '=', 'debit')
    .groupBy('tg.name')
    .orderBy(sql`total`, 'desc')
    .orderBy('tag', 'asc')
    .execute();

  return result.map((row) => ({
    tag: row.tag,
    total: toNumber(row.total),
  }));
}

export const getTransactionTagAnalysis = getTagBreakdown;

export async function getTopMerchants(
  ownerId: string,
): Promise<Array<{ merchant: string; total: number }>> {
  const result = await db
    .selectFrom('app.financeTransactions')
    .select([
      sql<string>`merchant_name`.as('merchant'),
      sql<number>`coalesce(sum(abs(amount)), 0)`.as('total'),
    ])
    .where('userId', '=', ownerId)
    .where('excluded', '=', false)
    .where('transactionType', '=', 'debit')
    .where('merchantName', 'is not', null)
    .where(sql<boolean>`merchant_name <> ''`)
    .groupBy('merchantName')
    .orderBy(sql`total`, 'desc')
    .orderBy('merchantName', 'asc')
    .limit(10)
    .execute();

  return result.map((row) => ({
    merchant: row.merchant ?? 'Unknown',
    total: toNumber(row.total),
  }));
}

export async function getTagBreakdownByContract(input: {
  userId: string;
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  tagIds?: string[];
  tagNames?: string[];
  limit?: number;
}): Promise<Array<{ tag: string; amount: number; transactionCount: number }>> {
  const transactions = await queryAnalyticsTransactionsByContract({
    userId: input.userId,
    accountId: input.accountId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    tagIds: input.tagIds,
    tagNames: input.tagNames,
    limit: 200,
    offset: 0,
  });

  const breakdownByLabel = new Map<string, { amount: number; transactionCount: number }>();
  for (const tx of transactions) {
    if (tx.amount >= 0) {
      continue;
    }
    const current = breakdownByLabel.get(tx.classification) ?? { amount: 0, transactionCount: 0 };
    current.amount += Math.abs(tx.amount);
    current.transactionCount += 1;
    breakdownByLabel.set(tx.classification, current);
  }

  const normalizedLimit = Math.max(1, Math.floor(input.limit ?? 5));
  return [...breakdownByLabel.entries()]
    .map(([tag, value]) => ({
      tag,
      amount: value.amount,
      transactionCount: value.transactionCount,
    }))
    .sort((a, b) => b.amount - a.amount || a.tag.localeCompare(b.tag))
    .slice(0, normalizedLimit);
}

export async function getTopMerchantsByContract(input: {
  userId: string;
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  tagIds?: string[];
  tagNames?: string[];
  limit?: number;
}): Promise<{
  merchants: Array<{ name: string; totalSpent: number; transactionCount: number }>;
  currencyCode: string | null;
  warnings: string[];
}> {
  const transactions = await queryAnalyticsTransactionsByContract({
    userId: input.userId,
    accountId: input.accountId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    tagIds: input.tagIds,
    tagNames: input.tagNames,
    limit: 200,
    offset: 0,
  });

  const merchantTotals = new Map<string, { totalSpent: number; transactionCount: number }>();
  const spendingCurrencies: string[] = [];
  for (const tx of transactions) {
    if (tx.amount >= 0) {
      continue;
    }
    spendingCurrencies.push(tx.currencyCode);
    const merchantName = tx.merchantName ?? 'Unknown';
    const current = merchantTotals.get(merchantName) ?? { totalSpent: 0, transactionCount: 0 };
    current.totalSpent += Math.abs(tx.amount);
    current.transactionCount += 1;
    merchantTotals.set(merchantName, current);
  }

  const normalizedLimit = Math.max(1, Math.floor(input.limit ?? 5));
  const { currencyCode, warnings } = summarizeCurrencies(spendingCurrencies);
  return {
    merchants: [...merchantTotals.entries()]
      .map(([name, value]) => ({
        name,
        totalSpent: value.totalSpent,
        transactionCount: value.transactionCount,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent || a.name.localeCompare(b.name))
      .slice(0, normalizedLimit),
    currencyCode,
    warnings,
  };
}

export async function getMonthlyStatsByContract(input: {
  userId: string;
  month?: string;
}): Promise<{
  month: string;
  income: number | null;
  expenses: number | null;
  net: number | null;
  transactionCount: number;
  averageTransaction: number | null;
  topTag: string | null;
  topMerchant: string | null;
  tagSpending: Array<{ name: string; amount: number; currencyCode: string }>;
  currencyBreakdown: Array<{
    currencyCode: string;
    income: number;
    expenses: number;
    net: number;
    transactionCount: number;
    averageTransaction: number;
    topTag: string;
    topMerchant: string;
    tagSpending: Array<{ name: string; amount: number }>;
  }>;
  startDate?: string;
  endDate?: string;
  currencyCode: string | null;
  warnings: string[];
}> {
  const range = parseMonthRange(input.month);
  const query = {
    userId: input.userId,
    ...(range.from ? { dateFrom: range.from } : {}),
    ...(range.to ? { dateTo: range.to } : {}),
  };
  const transactions: Awaited<ReturnType<typeof queryAnalyticsTransactionsByContract>> = [];
  for (let offset = 0; ; offset += 200) {
    const page = await queryAnalyticsTransactionsByContract({ ...query, limit: 200, offset });
    transactions.push(...page);
    if (page.length < 200) break;
  }

  const byCurrency = new Map<
    string,
    {
      income: number;
      expenses: number;
      categoryTotals: Map<string, number>;
      merchantTotals: Map<string, number>;
      transactionCount: number;
    }
  >();
  for (const tx of transactions) {
    const current = byCurrency.get(tx.currencyCode) ?? {
      income: 0,
      expenses: 0,
      categoryTotals: new Map<string, number>(),
      merchantTotals: new Map<string, number>(),
      transactionCount: 0,
    };
    current.transactionCount += 1;
    if (tx.amount >= 0) {
      current.income += tx.amount;
      byCurrency.set(tx.currencyCode, current);
      continue;
    }
    const spend = Math.abs(tx.amount);
    current.expenses += spend;
    current.categoryTotals.set(
      tx.classification,
      (current.categoryTotals.get(tx.classification) ?? 0) + spend,
    );
    const merchantName = tx.merchantName ?? 'Unknown';
    current.merchantTotals.set(
      merchantName,
      (current.merchantTotals.get(merchantName) ?? 0) + spend,
    );
    byCurrency.set(tx.currencyCode, current);
  }
  const currencyBreakdown = [...byCurrency.entries()]
    .map(([currencyCode, value]) => {
      const topTag =
        [...value.categoryTotals.entries()].sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
        )[0]?.[0] ?? 'Uncategorized';
      const topMerchant =
        [...value.merchantTotals.entries()].sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
        )[0]?.[0] ?? 'Unknown';
      return {
        currencyCode,
        income: value.income,
        expenses: value.expenses,
        net: value.income - value.expenses,
        transactionCount: value.transactionCount,
        averageTransaction:
          value.transactionCount === 0
            ? 0
            : (value.income + value.expenses) / value.transactionCount,
        topTag,
        topMerchant,
        tagSpending: [...value.categoryTotals.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 10)
          .map(([name, amount]) => ({ name, amount })),
      };
    })
    .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));
  const currencyCode =
    currencyBreakdown.length === 1 ? (currencyBreakdown[0]?.currencyCode ?? null) : null;
  const warnings =
    currencyBreakdown.length > 1
      ? [
          'Monthly totals span multiple currencies; totals and rankings are reported separately by currency.',
        ]
      : [];
  const single = currencyBreakdown.length === 1 ? currencyBreakdown[0] : null;
  const transactionCount = transactions.length;
  const averageTransaction =
    single?.averageTransaction ?? (currencyBreakdown.length === 0 ? 0 : null);
  return {
    month: input.month ?? new Date().toISOString().slice(0, 7),
    income: single?.income ?? (currencyBreakdown.length === 0 ? 0 : null),
    expenses: single?.expenses ?? (currencyBreakdown.length === 0 ? 0 : null),
    net: single?.net ?? (currencyBreakdown.length === 0 ? 0 : null),
    transactionCount,
    averageTransaction,
    topTag: single?.topTag ?? (currencyBreakdown.length === 0 ? 'Uncategorized' : null),
    topMerchant: single?.topMerchant ?? (currencyBreakdown.length === 0 ? 'Unknown' : null),
    tagSpending:
      single?.tagSpending.map((item) => ({ ...item, currencyCode: single.currencyCode })) ?? [],
    currencyBreakdown,
    ...(range.from ? { startDate: range.from } : {}),
    ...(range.to ? { endDate: range.to } : {}),
    currencyCode,
    warnings,
  };
}

export async function getSpendingTimeSeriesByContract(input: {
  userId: string;
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  tagIds?: string[];
  tagNames?: string[];
  limit?: number;
  groupBy?: 'month' | 'week' | 'day';
  includeStats?: boolean;
}): Promise<{
  data: Array<{
    date: string;
    amount: number;
    expenses: number;
    income: number;
    count: number;
    average: number;
  }>;
  stats?: {
    total: number;
    average: number;
    min: number;
    max: number;
    trend: 'up' | 'down' | 'stable';
    changePercentage: number;
    totalIncome: number;
    totalExpenses: number;
    averageIncome: number;
    averageExpenses: number;
    count: number;
    periodCovered: string;
  };
}> {
  const transactions = await queryAnalyticsTransactionsByContract({
    userId: input.userId,
    ...(input.accountId ? { accountId: input.accountId } : {}),
    ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
    ...(input.dateTo ? { dateTo: input.dateTo } : {}),
    ...(input.tagIds ? { tagIds: input.tagIds } : {}),
    ...(input.tagNames ? { tagNames: input.tagNames } : {}),
    limit: 200,
    offset: 0,
  });

  const bucketData = new Map<string, { income: number; expenses: number; count: number }>();
  for (const tx of transactions) {
    if (tx.postedOn === null) continue;
    const postedOn = typeof tx.postedOn === 'string' ? tx.postedOn : tx.postedOn.toISOString();
    const bucketKey = getTimeSeriesBucket(postedOn, input.groupBy);
    const current = bucketData.get(bucketKey) ?? { income: 0, expenses: 0, count: 0 };
    if (tx.amount >= 0) {
      current.income += tx.amount;
    } else {
      current.expenses += Math.abs(tx.amount);
    }
    current.count += 1;
    bucketData.set(bucketKey, current);
  }

  const normalizedLimit = Math.max(1, Math.floor(input.limit ?? 50));
  const sortedDates = [...bucketData.keys()]
    .sort((a, b) => a.localeCompare(b))
    .slice(-normalizedLimit);
  const data = sortedDates.map((date) => {
    const values = bucketData.get(date) ?? { income: 0, expenses: 0, count: 0 };
    const total = values.income + values.expenses;
    return {
      date,
      amount: values.income - values.expenses,
      expenses: values.expenses,
      income: values.income,
      count: values.count,
      average: values.count === 0 ? 0 : total / values.count,
    };
  });

  if (!input.includeStats) {
    return { data };
  }

  const totals = data.map((item) => item.income + item.expenses);
  const total = totals.reduce((sum, value) => sum + value, 0);
  const first = totals[0] ?? 0;
  const last = totals[totals.length - 1] ?? 0;

  return {
    data,
    stats: {
      total,
      average: totals.length === 0 ? 0 : total / totals.length,
      min: totals.length === 0 ? 0 : Math.min(...totals),
      max: totals.length === 0 ? 0 : Math.max(...totals),
      trend: last > first ? 'up' : last < first ? 'down' : 'stable',
      changePercentage: first === 0 ? 0 : ((last - first) / first) * 100,
      totalIncome: data.reduce((sum, item) => sum + item.income, 0),
      totalExpenses: data.reduce((sum, item) => sum + item.expenses, 0),
      averageIncome:
        data.length === 0 ? 0 : data.reduce((sum, item) => sum + item.income, 0) / data.length,
      averageExpenses:
        data.length === 0 ? 0 : data.reduce((sum, item) => sum + item.expenses, 0) / data.length,
      count: data.length,
      periodCovered: input.groupBy ?? 'day',
    },
  };
}

function parseMonthRange(month?: string): { from?: string; to?: string } {
  if (!month) {
    return {};
  }
  const [yearRaw, monthRaw] = month.split('-');
  const year = Number.parseInt(yearRaw ?? '', 10);
  const monthValue = Number.parseInt(monthRaw ?? '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(monthValue) || monthValue < 1 || monthValue > 12) {
    return {};
  }
  const from = new Date(Date.UTC(year, monthValue - 1, 1));
  const to = new Date(Date.UTC(year, monthValue, 0));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function getTimeSeriesBucket(date: string, groupBy?: 'month' | 'week' | 'day'): string {
  if (groupBy === 'month') {
    return date.slice(0, 7);
  }
  if (groupBy === 'week') {
    const value = new Date(`${date}T00:00:00Z`);
    const day = value.getUTCDay() || 7;
    value.setUTCDate(value.getUTCDate() - day + 1);
    return value.toISOString().slice(0, 10);
  }
  return date;
}
