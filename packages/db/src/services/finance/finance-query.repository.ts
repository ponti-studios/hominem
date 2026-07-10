import { db } from '../../db';
import { ValidationError } from '../../errors';

export interface FinanceMonthlySummaryInput {
  month: string;
  limit?: number;
}

export interface FinanceTransactionSummaryRecord {
  transactionId: string;
  accountId: string;
  accountName: string;
  institutionName: string | null;
  postedOn: string;
  amount: number;
  transactionType: string;
  merchantName: string | null;
}

export interface FinanceMerchantSpendRecord {
  merchantName: string;
  totalSpent: number;
  transactionCount: number;
}

export interface FinanceMonthlySummaryRecord {
  month: string;
  startsOn: string;
  endsBefore: string;
  currencyCode: string;
  totalSpent: number;
  totalIncome: number;
  transactionCount: number;
  topMerchants: FinanceMerchantSpendRecord[];
  transactions: FinanceTransactionSummaryRecord[];
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

function boundedLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new ValidationError('limit must be a positive integer.');
  }
  return Math.min(limit, MAX_LIMIT);
}

function parseMonth(month: string): { month: string; startsOn: string; endsBefore: string } {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new ValidationError('month must use YYYY-MM format.');
  }

  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const starts = new Date(Date.UTC(year, monthIndex, 1));
  if (
    Number.isNaN(starts.valueOf()) ||
    starts.getUTCFullYear() !== year ||
    starts.getUTCMonth() !== monthIndex
  ) {
    throw new ValidationError('month must use YYYY-MM format.');
  }

  const ends = new Date(Date.UTC(year, monthIndex + 1, 1));
  return {
    month,
    startsOn: starts.toISOString().slice(0, 10),
    endsBefore: ends.toISOString().slice(0, 10),
  };
}

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function expenseAmount(row: { amount: unknown; transactionType: string }): number {
  const amount = numberValue(row.amount);
  if (row.transactionType === 'expense' || row.transactionType === 'debit') return Math.abs(amount);
  return amount < 0 ? Math.abs(amount) : 0;
}

function incomeAmount(row: { amount: unknown; transactionType: string }): number {
  const amount = numberValue(row.amount);
  if (row.transactionType === 'income' || row.transactionType === 'credit')
    return Math.max(amount, 0);
  return amount > 0 ? amount : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export class FinanceQueryRepository {
  static async monthlySummary(
    ownerUserId: string,
    input: FinanceMonthlySummaryInput,
  ): Promise<FinanceMonthlySummaryRecord> {
    const range = parseMonth(input.month);
    const limit = boundedLimit(input.limit);

    const rows = await db
      .selectFrom('app.financeTransactions as transaction')
      .innerJoin('app.financeAccounts as account', 'account.id', 'transaction.accountId')
      .leftJoin('app.financeInstitutions as institution', 'institution.id', 'account.institutionId')
      .select([
        'transaction.id as transactionId',
        'transaction.accountId as accountId',
        'account.name as accountName',
        'account.currencyCode as currencyCode',
        'institution.name as institutionName',
        'transaction.postedOn as postedOn',
        'transaction.amount as amount',
        'transaction.transactionType as transactionType',
        'transaction.merchantName as merchantName',
      ])
      .where('transaction.userId', '=', ownerUserId)
      .where('account.userId', '=', ownerUserId)
      .where('transaction.postedOn', '>=', range.startsOn)
      .where('transaction.postedOn', '<', range.endsBefore)
      .orderBy('transaction.postedOn', 'asc')
      .orderBy('transaction.id', 'asc')
      .execute();

    const transactionCount = rows.length;
    const totalSpent = roundMoney(rows.reduce((sum, row) => sum + expenseAmount(row), 0));
    const totalIncome = roundMoney(rows.reduce((sum, row) => sum + incomeAmount(row), 0));
    const currencyCode = rows[0]?.currencyCode ?? 'USD';
    const merchantTotals = new Map<string, { totalSpent: number; transactionCount: number }>();

    for (const row of rows) {
      const merchantName = row.merchantName?.trim();
      const spent = expenseAmount(row);
      if (!merchantName || spent <= 0) continue;
      const current = merchantTotals.get(merchantName) ?? { totalSpent: 0, transactionCount: 0 };
      current.totalSpent += spent;
      current.transactionCount += 1;
      merchantTotals.set(merchantName, current);
    }

    const topMerchants = [...merchantTotals.entries()]
      .map(([merchantName, value]) => ({
        merchantName,
        totalSpent: roundMoney(value.totalSpent),
        transactionCount: value.transactionCount,
      }))
      .sort(
        (left, right) =>
          right.totalSpent - left.totalSpent || left.merchantName.localeCompare(right.merchantName),
      )
      .slice(0, limit);

    return {
      ...range,
      currencyCode,
      totalSpent,
      totalIncome,
      transactionCount,
      topMerchants,
      transactions: rows.slice(0, limit).map((row) => ({
        transactionId: row.transactionId,
        accountId: row.accountId,
        accountName: row.accountName,
        institutionName: row.institutionName,
        postedOn: String(row.postedOn),
        amount: numberValue(row.amount),
        transactionType: row.transactionType,
        merchantName: row.merchantName,
      })),
    };
  }
}
