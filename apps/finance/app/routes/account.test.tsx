import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUser, mockMutation, mockQueryClient } = vi.hoisted(() => ({
  mockUser: vi.fn(),
  mockMutation: { mutate: vi.fn(), isPending: false },
  mockQueryClient: { invalidateQueries: vi.fn() },
}));

vi.mock('react-router', () => ({ useRouteLoaderData: () => ({ user: mockUser() }) }));
vi.mock('@tanstack/react-query', () => ({
  useMutation: () => mockMutation,
  useQueryClient: () => mockQueryClient,
}));
vi.mock('../components/finance/export-transactions', () => ({
  ExportTransactions: () => <div>Export transactions</div>,
}));
vi.mock('../lib/api/provider', () => ({ useFinanceApiClient: vi.fn() }));
vi.mock('~/lib/auth-client', () => ({ authClient: { signOut: vi.fn() } }));
vi.mock('~/lib/toast', () => ({ toast: vi.fn() }));

import AccountPage from './account';

describe('Finance account page', () => {
  beforeEach(() => {
    mockUser.mockReset();
    mockUser.mockReturnValue({ id: 'user-1', name: 'Test User', email: 'test@lvh.me' });
  });

  it('shows the signed-in user name and email', () => {
    render(<AccountPage />);

    expect(screen.getByText('Your account')).toBeTruthy();
    expect(screen.getByText('Test User')).toBeTruthy();
    expect(screen.getByText('test@lvh.me')).toBeTruthy();
  });

  it('shows clear fallbacks when profile fields are missing', () => {
    mockUser.mockReturnValue({ id: 'user-1', name: null, email: '' });
    render(<AccountPage />);

    expect(screen.getByText('Name not provided')).toBeTruthy();
    expect(screen.getByText('Email unavailable')).toBeTruthy();
  });

  it('keeps transaction export without exposing an import workflow', () => {
    render(<AccountPage />);

    expect(screen.getByText('Export transactions')).toBeTruthy();
    expect(screen.queryByText(/import transactions/i)).toBeNull();
    expect(screen.queryByText(/import page/i)).toBeNull();
  });
});
