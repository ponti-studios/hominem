import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/modules/finance/lib/api', () => ({
  useFinanceQuery: (key: unknown[]) => {
    if (key[1] === 'accounts')
      return {
        data: {
          accounts: [
            {
              id: 'account-1',
              name: 'Everyday Checking',
              accountType: 'checking',
              currencyCode: 'GBP',
            },
          ],
        },
        isLoading: false,
      };
    if (key[2] === 'options')
      return {
        data: { categories: [{ id: 'category-1', name: 'Dining' }], tags: [] },
        isLoading: false,
      };
    return {
      data: {
        data: [
          {
            id: 'transaction-1',
            merchantName: 'Blue Bottle',
            description: 'Coffee shop',
            postedOn: '2026-11-14',
            accountName: 'Everyday Checking',
            amount: -6.5,
            currencyCode: 'GBP',
          },
        ],
      },
      isLoading: false,
    };
  },
}));

import { CommandPalette } from './command-palette';

afterEach(cleanup);

describe('CommandPalette', () => {
  it('renders its dialog on an opaque theme surface', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/finance/transactions']}>
        <CommandPalette open onClose={vi.fn()} />
      </MemoryRouter>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Search and commands' });
    expect(dialog.className).toContain('bg-background');
    expect(dialog.className).toContain('rounded-2xl');
    expect(dialog.className).toContain('shadow-2xl');
    expect(dialog.className).not.toMatch(/\bborder\b/);
    expect(dialog.parentElement?.querySelector('[aria-hidden]')?.className).toContain(
      'backdrop-blur-sm',
    );
    expect(dialog.parentElement?.querySelector('[aria-hidden]')?.className).toContain(
      'bg-black/55',
    );
    expect(screen.getByRole('option', { name: 'Tasks' }).textContent).toBe('Tasks');
    expect(screen.queryByText('Things to do, scheduled or not')).toBeNull();
    expect(
      screen.getByRole('combobox', {
        name: 'Search transactions, accounts, pages, and actions',
      }),
    ).toBeTruthy();
  });

  it('searches Finance records in the same palette as navigation', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/finance/transactions']}>
        <CommandPalette open onClose={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Search transactions, accounts, pages, and actions' }),
      { target: { value: 'blue' } },
    );

    await waitFor(() => expect(screen.getByRole('option', { name: /Blue Bottle/ })).toBeTruthy());
    expect(screen.getByRole('option', { name: /Search all transactions for/ })).toBeTruthy();
  });

  it('keeps transaction filters inside the same command palette', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/finance/transactions']}>
        <CommandPalette open onClose={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Filter transactions' }));

    expect(screen.getByRole('region', { name: 'Transaction filters' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Account' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeTruthy();
    expect(screen.getByLabelText('From date')).toBeTruthy();
  });

  it('closes the filter panel before closing the palette with Escape', async () => {
    const onClose = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/finance/transactions']}>
        <CommandPalette open onClose={onClose} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Filter transactions' }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Account' }), { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Transaction filters' })).toBeNull(),
    );
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Search and commands' }), {
      key: 'Escape',
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
