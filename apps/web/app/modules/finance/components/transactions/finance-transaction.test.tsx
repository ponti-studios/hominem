import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FinanceTransaction, type FinanceTransactionData } from './finance-transaction';

const transaction: FinanceTransactionData = {
  id: 'b4000006-0000-4000-8000-000000000001',
  userId: 'b4000001-0000-4000-8000-000000000001',
  accountId: 'b4000003-0000-4000-8000-000000000001',
  accountName: 'Everyday',
  amount: -12.5,
  description: 'Corner shop purchase',
  postedOn: '2026-11-14',
  merchantName: 'Corner Shop',
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
};

describe('FinanceTransaction', () => {
  it('renders a one-line merchant, category state, and amount with selection', () => {
    const onSelect = vi.fn();
    render(
      <FinanceTransaction
        transaction={transaction}
        selected
        suggestion="Groceries"
        onSelect={onSelect}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText('Corner Shop')).toBeInTheDocument();
    expect(screen.getByText('Groceries · Suggested')).toBeInTheDocument();
    expect(screen.getByLabelText('-£12.50')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Corner Shop' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Corner Shop' }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByText('2026-11-14')).not.toBeInTheDocument();
    expect(screen.getByText('Corner Shop').className).toContain('truncate');
  });
});
