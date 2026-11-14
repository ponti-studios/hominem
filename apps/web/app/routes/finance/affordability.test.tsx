import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface AffordabilityContextFixture {
  asOfDate: string;
  currencyCode: string | null;
  availableCurrencies: string[];
  liquidAccounts: Array<{ accountName: string; balance: number }>;
  startingCash: number | null;
  monthlyIncome: number | null;
  monthlyExpenses: number | null;
  historyStartDate: string;
  historyEndDate: string;
  historyMonthCount: number;
  transactionCount: number;
  warnings: string[];
}

interface AffordabilityResultFixture {
  currencyCode: string;
  purchaseAmount: number;
  currentBalance: number;
  balanceAfterPurchase: number;
  reserveTarget: number | null;
  reserveShortfall: number | null;
  monthlySurplus: number;
  monthsUntilDepletion: number | null;
  monthlyIncome: number;
  monthlyExpenses: number;
  explanation: string;
  historyStartDate: string;
  historyEndDate: string;
  balanceSource: string;
  monthlyIncomeSource: string;
  monthlyExpensesSource: string;
}

interface HookMocks {
  context: {
    data: AffordabilityContextFixture;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: ReturnType<typeof vi.fn>;
  };
  saveCurrency: {
    mutate: ReturnType<typeof vi.fn>;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
  };
  check: {
    mutate: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    data: AffordabilityResultFixture | null;
  };
}

const hookMocks = vi.hoisted((): HookMocks => ({
  context: {
    data: {
      asOfDate: '2026-11-11',
      currencyCode: 'GBP',
      availableCurrencies: ['GBP', 'USD'],
      liquidAccounts: [
        { accountName: 'Checking', balance: 1600 },
        { accountName: 'Savings', balance: 1000 },
      ],
      startingCash: 2600,
      monthlyIncome: 2000,
      monthlyExpenses: 1000,
      historyStartDate: '2026-05-01',
      historyEndDate: '2026-10-31',
      historyMonthCount: 6,
      transactionCount: 24,
      warnings: ['Only GBP is included. Other currencies excluded: USD.'],
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  },
  saveCurrency: { mutate: vi.fn(), isPending: false, isError: false, error: null },
  check: {
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: null,
  },
}));

vi.mock('~/modules/finance/hooks/use-affordability', () => ({
  useAffordabilityContext: () => hookMocks.context,
  useSaveAffordabilityCurrency: () => hookMocks.saveCurrency,
  useCheckAffordability: () => hookMocks.check,
}));

import AffordabilityPage from './affordability';

afterEach(cleanup);

describe('AffordabilityPage', () => {
  beforeEach(() => {
    hookMocks.context = {
      data: {
        asOfDate: '2026-11-11',
        currencyCode: 'GBP',
        availableCurrencies: ['GBP', 'USD'],
        liquidAccounts: [{ accountName: 'Checking', balance: 2600 }],
        startingCash: 2600,
        monthlyIncome: 2000,
        monthlyExpenses: 1000,
        historyStartDate: '2026-05-01',
        historyEndDate: '2026-10-31',
        historyMonthCount: 6,
        transactionCount: 24,
        warnings: ['Only GBP is included. Other currencies excluded: USD.'],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    hookMocks.saveCurrency = {
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    };
    hookMocks.check = {
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      data: null,
    };
  });

  it('prefills Finance values and submits only temporary user edits', () => {
    const { rerender } = render(<AffordabilityPage />);

    expect(screen.getByLabelText('Average monthly income')).toHaveValue(2000);
    expect(screen.getByLabelText('Average monthly expenses')).toHaveValue(1000);
    expect(screen.getByLabelText('Available cash')).toHaveValue('2,600.00');
    expect(screen.getAllByText('£', { exact: true })).toHaveLength(5);
    expect(screen.getByText('Purchase amount')).toHaveClass('bg-muted', 'text-xs', 'font-normal');
    expect(screen.queryByText(/From Checking/)).not.toBeInTheDocument();
    expect(screen.queryByText(/From Savings/)).not.toBeInTheDocument();
    expect(screen.getByText(/2026-05-01 to 2026-10-31/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Purchase amount'), {
      target: { value: '250.50' },
    });
    fireEvent.change(screen.getByLabelText('Average monthly income'), {
      target: { value: '2400' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check purchase impact' }));

    expect(hookMocks.check.mutate).toHaveBeenCalledWith({
      purchaseAmount: 250.5,
      monthlyIncomeOverride: 2400,
    });

    hookMocks.check.data = {
      currencyCode: 'GBP',
      purchaseAmount: 250.5,
      currentBalance: 2600,
      balanceAfterPurchase: 2349.5,
      reserveTarget: 3000,
      reserveShortfall: 650.5,
      monthlySurplus: 1400,
      monthsUntilDepletion: null,
      monthlyIncome: 2400,
      monthlyExpenses: 1000,
      explanation: 'Remaining cash is below the GBP reserve target.',
      historyStartDate: '2026-05-01',
      historyEndDate: '2026-10-31',
      balanceSource: 'finance',
      monthlyIncomeSource: 'manual',
      monthlyExpensesSource: 'finance',
    };
    rerender(<AffordabilityPage />);
    expect(screen.getByRole('heading', { name: 'Purchase impact' })).toBeInTheDocument();
    expect(screen.getByText('£2,349.50')).toBeInTheDocument();
    expect(screen.queryByText('Verdict')).not.toBeInTheDocument();
  });

  it('requires missing cash and history inputs before enabling a check', () => {
    hookMocks.context = {
      ...hookMocks.context,
      data: {
        ...hookMocks.context.data,
        currencyCode: 'GBP',
        liquidAccounts: [],
        startingCash: null,
        monthlyIncome: null,
        monthlyExpenses: null,
        transactionCount: 0,
        warnings: ['No eligible liquid accounts are available in GBP.'],
      },
    };

    render(<AffordabilityPage />);
    expect(screen.getByLabelText('Available cash')).toHaveValue(null);
    expect(screen.getByLabelText('Average monthly income')).toHaveValue(null);
    expect(screen.getByRole('button', { name: 'Check purchase impact' })).toBeDisabled();
    expect(screen.getAllByText(/No history found/)).toHaveLength(2);
  });

  it('shows a server calculation error accessibly', () => {
    hookMocks.check = {
      ...hookMocks.check,
      isError: true,
      error: new Error('Enter a temporary cash balance to continue.'),
    };

    render(<AffordabilityPage />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a temporary cash balance to continue.',
    );
  });
});
