import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuthContext, useSafeAuth } from './client';
import type { User } from './types';

const initialUser: User = {
  id: 'user-1',
  email: 'user@example.com',
  createdAt: '2026-03-10T12:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });
}

function AuthConsumer() {
  const { isAuthenticated, user } = useAuthContext();

  return (
    <div>
      <div data-testid="authenticated">{isAuthenticated ? 'authenticated' : 'signed-out'}</div>
      <div data-testid="email">{user?.email ?? 'missing'}</div>
    </div>
  );
}

function SignOutConsumer() {
  const { isAuthenticated, signOut } = useAuthContext();
  const [result, setResult] = useState('idle');

  return (
    <div>
      <div data-testid="authenticated">{isAuthenticated ? 'authenticated' : 'signed-out'}</div>
      <div data-testid="signout-result">{result}</div>
      <button
        onClick={() => {
          void signOut().then(
            () => {
              setResult('success');
            },
            (error: unknown) => {
              setResult(error instanceof Error ? error.message : 'Sign out failed');
            },
          );
        }}
        type="button"
      >
        Sign out
      </button>
    </div>
  );
}

function SafeAuthConsumer() {
  const auth = useSafeAuth();

  return <div data-testid="safe-auth">{auth ? 'available' : 'missing'}</div>;
}

function StrictAuthConsumer() {
  const { userId } = useAuthContext();

  return <div data-testid="strict-auth">{userId ?? 'no-user'}</div>;
}

describe('AuthProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates authenticated state from the server session before the client session probe settles', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const onAuthEvent = vi.fn();

    render(
      <AuthProvider
        config={{ apiBaseUrl: 'http://localhost:4040' }}
        initialUser={initialUser}
        onAuthEvent={onAuthEvent}
      >
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('authenticated');
      expect(screen.getByTestId('email').textContent).toBe('user@example.com');
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onAuthEvent).not.toHaveBeenCalled();
  });

  it('treats a 401 session probe as signed out without calling the refresh route', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ isAuthenticated: false, user: null }, { status: 401 }),
    );

    render(
      <AuthProvider config={{ apiBaseUrl: 'http://localhost:4040' }}>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('signed-out');
      expect(screen.getByTestId('email').textContent).toBe('missing');
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:4040/api/auth/session',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('restores authenticated state from an identity-only session probe', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        isAuthenticated: true,
        user: initialUser,
        auth: {
          sub: initialUser.id,
          sid: 'session-1',
          amr: ['better-auth-session'],
          authTime: 1,
        },
      }),
    );

    render(
      <AuthProvider config={{ apiBaseUrl: 'http://localhost:4040' }}>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('authenticated');
      expect(screen.getByTestId('email').textContent).toBe('user@example.com');
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:4040/api/auth/session',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('clears authenticated state and emits SIGNED_OUT when logout succeeds', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(jsonResponse({ success: true }));
    const onAuthEvent = vi.fn();

    render(
      <AuthProvider
        config={{ apiBaseUrl: 'http://localhost:4040' }}
        initialUser={initialUser}
        onAuthEvent={onAuthEvent}
      >
        <SignOutConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('authenticated');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('signed-out');
      expect(screen.getByTestId('signout-result').textContent).toBe('success');
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:4040/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
    expect(onAuthEvent).toHaveBeenCalledWith('SIGNED_OUT');
  });

  it('keeps the user signed in when logout invalidation fails', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'upstream_failed' }, { status: 503 }));

    render(
      <AuthProvider config={{ apiBaseUrl: 'http://localhost:4040' }} initialUser={initialUser}>
        <SignOutConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('authenticated');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('authenticated');
      expect(screen.getByTestId('signout-result').textContent).toContain('Failed to sign out');
    });
  });

  it('returns null from useSafeAuth outside the provider', () => {
    render(<SafeAuthConsumer />);

    expect(screen.getByTestId('safe-auth').textContent).toBe('missing');
  });

  it('throws from useAuthContext outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<StrictAuthConsumer />);
    }).toThrow('useAuthContext must be used within an AuthProvider');

    consoleError.mockRestore();
  });
});
