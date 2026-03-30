import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isMockAuthEnabledMock } = vi.hoisted(() => ({
  isMockAuthEnabledMock: vi.fn(() => true),
}));

vi.mock('./config', () => ({
  isMockAuthEnabled: isMockAuthEnabledMock,
}));

import { LocalMockAuthProvider, useAuth } from './AuthContext';
import { DEFAULT_MOCK_USER, MOCK_USERS } from './mock-users';

const STORAGE_KEY = 'hominem_auth_session';

function MockAuthConsumer() {
  const { isAuthenticated, isLoading, signIn, signOut, user } = useAuth();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'authenticated' : 'signed-out'}</div>
      <div data-testid="email">{user?.email ?? 'missing'}</div>
      <button onClick={() => void signIn()} type="button">
        Sign in
      </button>
      <button onClick={() => void signOut()} type="button">
        Sign out
      </button>
    </div>
  );
}

describe('LocalMockAuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    isMockAuthEnabledMock.mockReturnValue(true);
  });

  it('throws when useAuth is rendered outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<MockAuthConsumer />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleError.mockRestore();
  });

  it('restores a persisted mock session on mount', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        user: MOCK_USERS.tester,
      }),
    );

    render(
      <LocalMockAuthProvider>
        <MockAuthConsumer />
      </LocalMockAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
    });

    expect(screen.getByTestId('email')).toHaveTextContent(MOCK_USERS.tester.email);
  });

  it('fails closed on corrupt persisted sessions and clears the bad payload', async () => {
    localStorage.setItem(STORAGE_KEY, '{bad-json');

    render(
      <LocalMockAuthProvider>
        <MockAuthConsumer />
      </LocalMockAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('signed-out');
    });

    expect(screen.getByTestId('email')).toHaveTextContent('missing');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('persists the signed-in identity and clears it on sign-out', async () => {
    const user = userEvent.setup();

    render(
      <LocalMockAuthProvider>
        <MockAuthConsumer />
      </LocalMockAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
    });

    expect(screen.getByTestId('email')).toHaveTextContent(DEFAULT_MOCK_USER.email);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      user?: { id?: string; email?: string };
    };
    expect(persisted.user).toMatchObject({
      id: DEFAULT_MOCK_USER.id,
      email: DEFAULT_MOCK_USER.email,
    });

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('signed-out');
      expect(screen.getByTestId('email')).toHaveTextContent('missing');
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
