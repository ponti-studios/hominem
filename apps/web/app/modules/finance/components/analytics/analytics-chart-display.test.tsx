import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockUseTimeSeriesData } = vi.hoisted(() => ({
  mockUseTimeSeriesData: vi.fn(),
}));

vi.mock('~/modules/finance/hooks/use-time-series', () => ({
  useTimeSeriesData: mockUseTimeSeriesData,
}));

import { AnalyticsChartDisplay } from './analytics-chart-display';

afterEach(cleanup);

describe('AnalyticsChartDisplay', () => {
  it('queries the exact selected date range', () => {
    mockUseTimeSeriesData.mockReturnValue({ isLoading: true, error: null, data: undefined });
    const dateFrom = new Date(2026, 4, 11);
    const dateTo = new Date(2026, 10, 11);

    render(
      <AnalyticsChartDisplay
        chartType="area"
        setChartType={vi.fn()}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    );

    expect(mockUseTimeSeriesData).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom, dateTo, groupBy: 'month' }),
    );
  });
});
