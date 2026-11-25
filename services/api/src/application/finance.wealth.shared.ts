import {
  getAccountSummaries,
  getFinanceAccountList,
  getFinanceNetWorth,
  getFinanceSpendingByCategory,
} from '@hominem/finance-services';

import { financeRunwayOutputSchema } from '../schemas/finance.schema';
import { listBills } from './finance-bills.service';
import { listBudgets } from './finance-budgets.service';
import { getFinanceLedgerRunway } from './finance.runway.service';
import {
  getMonthlyStatsReport,
  getTagBreakdownReport,
  isUuid,
  searchTransactions,
} from './finance.service';

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isoPlusDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function isoMinusDays(iso: string, days: number): string {
  return isoPlusDays(iso, -days);
}

export function isoDaysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function isoAddMonths(iso: string, months: number): string {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  const index = year * 12 + month - 1 + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (((index % 12) + 12) % 12) + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export function monthBounds(month: string): { from: string; to: string } {
  const from = `${month}-01`;
  return { from, to: isoMinusDays(isoAddMonths(from, 1), 1) };
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type HominemSearchRow = Awaited<ReturnType<typeof searchTransactions>>['data'][number];
export type HominemBillRow = Awaited<ReturnType<typeof listBills>>['bills'][number];

export function matchesMerchant(row: HominemSearchRow, query: string): boolean {
  const term = query.toLowerCase();
  return [row.merchantName, row.description].some((value) => value?.toLowerCase().includes(term));
}

export type SearchTransactionsInput = {
  query?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  accountId?: string | undefined;
  tag?: string | undefined;
  categoryName?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export function createReportReads(ownerUserId: string, asOf: string) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    async listFinanceAccounts() {
      calls += 1;
      const result = await getFinanceAccountList(ownerUserId, { includeClosed: false });
      return {
        ...result,
        accounts: result.accounts.map((account) => ({
          ...account,
          balance: account.balanceCents / 100,
        })),
      };
    },
    async accountSummary() {
      calls += 1;
      const result = await getAccountSummaries(ownerUserId);
      return {
        accounts: result.summaries.map((summary) => ({
          ...summary,
          totals: summary.totals.map(({ currencyCode, sumAmount }) => ({
            currencyCode,
            sum: sumAmount,
          })),
        })),
        totalCount: result.totalCount,
      };
    },
    async netWorth() {
      calls += 1;
      const report = await getFinanceNetWorth(ownerUserId, false);
      return {
        ...report,
        totals: report.totals.map((total) => ({ ...total, total: total.totalCents / 100 })),
        accounts: report.accounts.map((account) => ({
          ...account,
          balance: account.balanceCents / 100,
        })),
      };
    },
    async searchTransactions(input: SearchTransactionsInput) {
      calls += 1;
      const tags: { tagIds?: string[]; tagNames?: string[] } = {};
      if (input.tag) {
        if (isUuid(input.tag)) tags.tagIds = [input.tag];
        else tags.tagNames = [input.tag];
      }
      const result = await searchTransactions(ownerUserId, {
        accountIds: input.accountId ? [input.accountId] : [],
        dateFrom: input.from,
        dateTo: input.to,
        text: input.query,
        ...tags,
        categoryName: input.categoryName,
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      });
      return {
        transactions: result.data,
        count: result.data.length,
        filteredCount: result.filteredCount,
        totalUserCount: result.totalUserCount,
      };
    },
    async spendingByCategory(input: { from: string; to: string; limit: number }) {
      calls += 1;
      const result = await getFinanceSpendingByCategory(ownerUserId, input);
      return {
        ...result,
        categories: result.categories.map((category) => ({
          categoryId: category.categoryId,
          categoryName: category.categoryName,
          currencyCode: category.currencyCode,
          spent: category.spentCents / 100,
          transactionCount: category.transactionCount,
        })),
      };
    },
    async budgetList(date = asOf) {
      calls += 1;
      const result = await listBudgets(ownerUserId, new Date(`${date}T12:00:00Z`));
      if (!result.primaryCurrency) return result;
      const storedBudgets = result.budgets.flatMap((budget) => {
        const category = {
          id: budget.id,
          categoryId: budget.categoryId,
          categoryName: budget.categoryName,
          tagId: budget.tagId,
          tagName: budget.tagName,
          amountCents: budget.amountCents,
          cadence: budget.cadence,
        };
        const tags =
          'tagBudgets' in budget
            ? budget.tagBudgets.map((tag) => ({
                id: tag.budgetId,
                categoryId: budget.categoryId,
                categoryName: budget.categoryName,
                tagId: tag.tagId,
                tagName: tag.tagName,
                amountCents: tag.amountCents,
                cadence: tag.cadence,
              }))
            : [];
        return [category, ...tags];
      });
      return { ...result, storedBudgets };
    },
    async billList() {
      calls += 1;
      const result = await listBills(ownerUserId, { limit: 1001 }, new Date(`${asOf}T12:00:00Z`));
      if (result.bills.length > 1000)
        throw new Error('Bill register exceeds the 1,000-row report limit.');
      return result;
    },
    async runway(input: {
      asOf: string;
      projectionWeeks: number;
      monthlyBudgets: Array<{ category: string; amountCents: number }>;
    }) {
      calls += 1;
      const { runway } = await getFinanceLedgerRunway(ownerUserId, input);
      return financeRunwayOutputSchema.parse(runway);
    },
    async monthlyStats(month: string) {
      calls += 1;
      return getMonthlyStatsReport(ownerUserId, month);
    },
    async tagBreakdown(input: { from: string; to: string; tag: string; limit: number }) {
      calls += 1;
      return getTagBreakdownReport(ownerUserId, input);
    },
  };
}

export type ReportReads = ReturnType<typeof createReportReads>;
export type BudgetStoredRow = Awaited<
  ReturnType<ReportReads['budgetList']>
>['storedBudgets'][number];

export async function searchAll(
  reads: ReportReads,
  input: Omit<SearchTransactionsInput, 'limit' | 'offset'>,
): Promise<HominemSearchRow[]> {
  const rows: HominemSearchRow[] = [];
  for (let page = 0; page < 20; page += 1) {
    const result = await reads.searchTransactions({ ...input, limit: 50, offset: page * 50 });
    rows.push(...result.transactions);
    if (rows.length >= result.filteredCount) return rows;
    if (result.transactions.length === 0)
      throw new Error('Transaction search ended before all reported rows were read.');
  }
  throw new Error('Transaction search exceeds the 1,000-row report limit.');
}
