import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

vi.mock('../../lib/api/client', () => ({
  useHonoQuery: (key: unknown[]) => {
    if (key[1] === 'accounts') {
      return {
        data: {
          accounts: [
            {
              id: 'account-1',
              name: 'Everyday Checking',
              institutionName: 'Chase',
              accountType: 'checking',
              balanceCents: 120000,
              currencyCode: 'GBP',
            },
            {
              id: 'account-2',
              name: 'Travel Card',
              institutionName: 'American Express',
              accountType: 'credit',
              balanceCents: -8000,
              currencyCode: 'EUR',
            },
          ],
        },
        isLoading: false,
        error: null,
      };
    }
    return {
      data:
        typeof key[3] === 'string'
          ? {
              data: [
                {
                  id: 'transaction-1',
                  description: 'Coffee shop',
                  merchantName: 'Blue Bottle',
                  postedOn: '2026-10-12',
                  amount: -6.5,
                  currencyCode: 'EUR',
                },
              ],
            }
          : { data: [] },
      isLoading: false,
      error: null,
    };
  },
}));

import { FinanceSearch } from './finance-search';

describe('FinanceSearch', () => {
  beforeEach(() => navigate.mockClear());

  it('opens from the icon-only accessible trigger and places matching accounts before transactions', async () => {
    render(<FinanceSearch />);
    fireEvent.click(screen.getByRole('button', { name: 'Search transactions and accounts' }));
    const input = screen.getByRole('textbox', { name: 'Search transactions and accounts' });
    fireEvent.change(input, { target: { value: 'everydy' } });

    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Everyday Checking/ })).toBeTruthy(),
    );
    expect(screen.getByRole('option', { name: /£1,200/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Accounts' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Transactions' })).toBeTruthy();
    expect(
      screen
        .getByRole('heading', { name: 'Accounts' })
        .compareDocumentPosition(screen.getByRole('heading', { name: 'Transactions' })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText('All')).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /Everyday Checking/ }));
    expect(navigate).toHaveBeenCalledWith('/accounts/account-1');
  });

  it('does not activate hidden account matches before the minimum query length', async () => {
    render(<FinanceSearch />);
    fireEvent.click(screen.getByRole('button', { name: 'Search transactions and accounts' }));
    const input = screen.getByRole('textbox', { name: 'Search transactions and accounts' });
    await waitFor(() => expect(input).toHaveValue(''));

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not show an account section when no account matches and supports keyboard opening', async () => {
    render(<FinanceSearch />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    fireEvent.change(screen.getByRole('textbox', { name: 'Search transactions and accounts' }), {
      target: { value: 'blue' },
    });

    await waitFor(() => expect(screen.getByRole('option', { name: /Blue Bottle/ })).toBeTruthy());
    expect(screen.getByRole('option', { name: /€7/ })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Accounts' })).toBeNull();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith('/finance?search=Coffee%20shop');
  });

  it('moves through combined results and opens the selected transaction with Enter', async () => {
    render(<FinanceSearch />);
    fireEvent.click(screen.getByRole('button', { name: 'Search transactions and accounts' }));
    const input = screen.getByRole('textbox', { name: 'Search transactions and accounts' });
    fireEvent.change(input, { target: { value: 'e' } });
    fireEvent.change(input, { target: { value: 'everyday' } });

    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Everyday Checking/ })).toBeTruthy(),
    );
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith('/finance?search=Coffee%20shop');
  });

  it('closes with Escape and clears the next search session', async () => {
    render(<FinanceSearch />);
    const trigger = screen.getByRole('button', { name: 'Search transactions and accounts' });
    fireEvent.click(trigger);
    const input = screen.getByRole('textbox', { name: 'Search transactions and accounts' });
    expect(screen.getByText('Search by merchant, description, or account.')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'blue' } });
    await waitFor(() => expect(screen.getByRole('option', { name: /Blue Bottle/ })).toBeTruthy());

    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(trigger);
    expect(screen.getByRole('textbox', { name: 'Search transactions and accounts' })).toHaveValue(
      '',
    );
  });
});
