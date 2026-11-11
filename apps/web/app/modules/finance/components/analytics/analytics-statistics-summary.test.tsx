import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockUseTimeSeriesData } = vi.hoisted(() => ({
  mockUseTimeSeriesData: vi.fn(),
}));

vi.mock('~/modules/finance/hooks/use-time-series', () => ({
  useTimeSeriesData: mockUseTimeSeriesData,
}));

import { AnalyticsStatisticsSummary } from './analytics-statistics-summary';

afterEach(cleanup);

describe('AnalyticsStatisticsSummary', () => {
  it('presents summary amounts as receipt rows in one panel', () => {
    mockUseTimeSeriesData.mockReturnValue({
      data: {
        stats: {
          totalIncome: 105397,
          totalExpenses: 44050,
          averageIncome: 15057,
          averageExpenses: 6293,
          periodCovered: 'month',
          count: 7,
        },
      },
      isLoading: false,
      error: null,
    });

    const { container } = render(
      <AnalyticsStatisticsSummary
        dateFrom={new Date(2026, 4, 11)}
        dateTo={new Date(2026, 10, 11)}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Financial summary' })).toBeInTheDocument();
    expect(screen.getByText('May 11, 2026 – Nov 11, 2026')).toBeInTheDocument();
    expect(container.querySelectorAll('.divide-y > div')).toHaveLength(4);
    expect(screen.getByText('Total income')).toBeInTheDocument();
    expect(screen.getByText('$105,397')).toBeInTheDocument();
    expect(screen.getByText('Total expenses')).toBeInTheDocument();
    expect(screen.getByText('$44,050')).toBeInTheDocument();
    expect(screen.getByText('Avg income')).toBeInTheDocument();
    expect(screen.getByText('Avg expenses')).toBeInTheDocument();
    expect(screen.queryByText(/Over \d+ months/)).not.toBeInTheDocument();
  });
});
