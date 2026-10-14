import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { MonthlyStatsContract } from '~/lib/hooks/use-monthly-stats';

import { MonthlySummaryCard } from '../components/analytics/monthly-summary-card';

const mixedCurrencyStats: MonthlyStatsContract = {
  month: '2026-09',
  income: null,
  expenses: null,
  net: null,
  transactionCount: 2,
  averageTransaction: null,
  topTag: null,
  topMerchant: null,
  formattedIncome: null,
  formattedExpenses: null,
  formattedNet: null,
  formattedAverage: null,
  totalIncome: null,
  totalExpenses: null,
  netIncome: null,
  tagSpending: [],
  currencyCode: null,
  currencyBreakdown: [
    {
      currencyCode: 'GBP',
      income: 0,
      expenses: 200,
      net: -200,
      transactionCount: 1,
      averageTransaction: 200,
      topTag: 'Travel',
      topMerchant: 'Rail',
      tagSpending: [],
    },
    {
      currencyCode: 'USD',
      income: 300,
      expenses: 0,
      net: 300,
      transactionCount: 1,
      averageTransaction: 300,
      topTag: 'Uncategorized',
      topMerchant: 'Salary',
      tagSpending: [],
    },
  ],
};

describe('MonthlySummaryCard', () => {
  it('renders separate monetary totals for each currency', () => {
    render(<MonthlySummaryCard stats={mixedCurrencyStats} />);

    expect(screen.getByText('GBP')).toBeTruthy();
    expect(screen.getByText('USD')).toBeTruthy();
    expect(screen.getByText('£200')).toBeTruthy();
    expect(screen.getAllByText('$300')).toHaveLength(2);
    expect(screen.queryByText('$100')).toBeNull();
  });
});
