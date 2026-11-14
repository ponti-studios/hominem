import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  invalidate: vi.fn(),
  accountsMap: new Map([['account-1', { id: 'account-1', name: 'Everyday' }]]),
}));

vi.mock('@hominem/rpc/react', () => ({ useApiClient: () => ({}) }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const key = queryKey.map(String).join('.');
    if (key.includes('queue')) return { data: { verdicts: [] }, isLoading: false };
    if (key.includes('options'))
      return {
        data: {
          categories: [{ id: 'category-1', name: 'Food' }],
          tags: [{ id: 'tag-1', name: 'Coffee' }],
        },
        isLoading: false,
      };
    if (key.includes('current'))
      return { data: { rulebook: { merchantRules: [] } }, isLoading: false };
    return {
      data: {
        data: [
          {
            id: 'transaction-1',
            userId: 'user-1',
            accountId: 'account-1',
            accountName: 'Everyday',
            amount: -8.5,
            description: 'Coffee shop',
            postedOn: '2026-11-14',
            merchantName: 'Coffee Shop',
            currencyCode: 'GBP',
            transactionType: 'expense',
            categoryId: null,
            categoryName: null,
            tags: [],
            notes: null,
            counterpartId: null,
            recurring: false,
            pending: false,
            excluded: false,
            source: null,
          },
        ],
        filteredCount: 1,
        nextCursor: null,
      },
      isLoading: false,
      isFetching: false,
      error: null,
    };
  },
  useMutation: () => ({ mutate: mocks.mutate, isPending: false, error: null }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));
vi.mock('~/modules/finance/hooks/use-finance-data', () => ({
  useFinanceAccounts: () => ({ accountsMap: mocks.accountsMap }),
}));

import FinanceTransactionsPage from './transactions';

afterEach(() => {
  cleanup();
  mocks.mutate.mockReset();
});

describe('Finance Transactions ledger', () => {
  it('shows a single-line transaction and applies a category to selected rows', async () => {
    const user = userEvent.setup();
    render(<FinanceTransactionsPage />);

    expect(screen.getByText('Coffee Shop')).toBeInTheDocument();
    expect(screen.getByTitle('Uncategorized')).toBeInTheDocument();
    expect(screen.getByLabelText('-£8.50')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Select Coffee Shop' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    const categorySelect = screen.getAllByRole('combobox', { name: 'Category' }).at(-1)!;
    await user.click(categorySelect);
    await user.click(await screen.findByRole('option', { name: 'Food' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(mocks.mutate).toHaveBeenCalledWith({
      ids: ['transaction-1'],
      action: { action: 'category', categoryId: 'category-1' },
    });
  });

  it('keeps secondary bulk actions in a compact menu', async () => {
    const user = userEvent.setup();
    render(<FinanceTransactionsPage />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Coffee Shop' }));
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit tags…' }));

    expect(screen.getByRole('heading', { name: 'Edit tags' })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Tag' }));
    await user.click(await screen.findByRole('option', { name: 'Coffee' }));
    await user.click(screen.getByRole('button', { name: 'Apply to 1' }));
    expect(mocks.mutate).toHaveBeenCalledWith({
      ids: ['transaction-1'],
      action: { action: 'tags', tagIds: ['tag-1'] },
    });
  });
});
