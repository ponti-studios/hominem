import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseAllAccounts } = vi.hoisted(() => ({ mockUseAllAccounts: vi.fn() }));

vi.mock('../lib/hooks/use-finance-data', () => ({ useAllAccounts: mockUseAllAccounts }));
vi.mock('~/lib/api.server', () => ({ createServerHonoClient: vi.fn() }));
vi.mock('~/lib/require-auth.server', () => ({ requireAuth: vi.fn() }));
vi.mock('../components/route-link', () => ({
  RouteLink: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import AccountsPage from './accounts';

describe('Finance accounts page', () => {
  beforeEach(() => {
    mockUseAllAccounts.mockReturnValue({
      accounts: [
        {
          id: 'account-1',
          userId: 'user-1',
          name: 'Everyday Checking',
          accountType: 'depository',
          currentBalance: 1250,
          transactions: [],
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('shows the account ledger without connection controls or the removed intro block', () => {
    render(<AccountsPage loaderData={{ accounts: [] }} />);

    expect(screen.getByRole('heading', { name: 'Accounts' })).toBeTruthy();
    expect(screen.getByText('Everyday Checking')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add bank' })).toBeNull();
    expect(screen.queryByText('Your accounts')).toBeNull();
    expect(screen.queryByText('Balances and connections in one view.')).toBeNull();
    expect(screen.queryByText('Connected accounts')).toBeNull();
    expect(screen.queryByText('Manual accounts')).toBeNull();
  });
});
