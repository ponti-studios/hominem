import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockUseMonthlyStats, mockUseRunwaySettings } = vi.hoisted(() => ({
  mockUseMonthlyStats: vi.fn(),
  mockUseRunwaySettings: vi.fn(),
}));

vi.mock('~/modules/finance/hooks/use-monthly-stats', () => ({
  useMonthlyStats: mockUseMonthlyStats,
}));

vi.mock('~/modules/finance/hooks/use-runway-settings', () => ({
  useRunwaySettings: mockUseRunwaySettings,
}));

import { BudgetOverview } from './budget-overview';

afterEach(cleanup);

describe('BudgetOverview', () => {
  it('renders nothing when no budget categories exist', () => {
    mockUseRunwaySettings.mockReturnValue({
      data: { currencyCode: 'USD', budgets: [] },
      isLoading: false,
      error: null,
    });
    mockUseMonthlyStats.mockReturnValue({ stats: null, isLoading: false, error: null });

    const { container } = render(<BudgetOverview selectedMonthYear="2026-11" />);

    expect(screen.queryByText('No Budget Categories')).not.toBeInTheDocument();
    expect(screen.queryByText('Budget Performance')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when budget categories have no amounts set', () => {
    mockUseRunwaySettings.mockReturnValue({
      data: {
        currencyCode: 'USD',
        budgets: [{ currencyCode: 'USD', amount: 0 }],
      },
      isLoading: false,
      error: null,
    });
    mockUseMonthlyStats.mockReturnValue({ stats: null, isLoading: false, error: null });

    const { container } = render(<BudgetOverview selectedMonthYear="2026-11" />);

    expect(screen.queryByText('No Budget Set')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
