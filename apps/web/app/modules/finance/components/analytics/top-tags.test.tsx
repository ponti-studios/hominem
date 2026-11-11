import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockUseTagBreakdown } = vi.hoisted(() => ({
  mockUseTagBreakdown: vi.fn(),
}));

vi.mock('~/modules/finance/hooks/use-analytics', () => ({
  useTagBreakdown: mockUseTagBreakdown,
}));

import { TopTags } from './top-tags';

afterEach(cleanup);

describe('TopTags', () => {
  it('omits untagged expenses and fills the list with the top five named tags', () => {
    mockUseTagBreakdown.mockReturnValue({
      data: {
        breakdown: [
          { tag: '(untagged)', amount: 10000, transactionCount: 100, currencyCode: 'USD' },
          ...Array.from({ length: 6 }, (_, index) => ({
            tag: `Tag ${index + 1}`,
            amount: 1000 - index,
            transactionCount: 1,
            currencyCode: 'USD',
          })),
        ],
      },
      isLoading: false,
      error: null,
    });

    render(<TopTags />);

    expect(screen.queryByText('(untagged)')).not.toBeInTheDocument();
    expect(screen.getByText('Tag 5')).toBeInTheDocument();
    expect(screen.queryByText('Tag 6')).not.toBeInTheDocument();
    expect(mockUseTagBreakdown).toHaveBeenCalledWith({ limit: 50 });
  });

  it('renders nothing when the report has no data', () => {
    mockUseTagBreakdown.mockReturnValue({ data: undefined, isLoading: false, error: null });

    render(<TopTags />);

    expect(screen.queryByRole('heading', { name: 'Top Tags' })).not.toBeInTheDocument();
  });

  it('renders nothing when the report only contains untagged expenses', () => {
    mockUseTagBreakdown.mockReturnValue({
      data: {
        breakdown: [
          { tag: '(untagged)', amount: 10000, transactionCount: 100, currencyCode: 'USD' },
        ],
      },
      isLoading: false,
      error: null,
    });

    render(<TopTags />);

    expect(screen.queryByRole('heading', { name: 'Top Tags' })).not.toBeInTheDocument();
  });
});
