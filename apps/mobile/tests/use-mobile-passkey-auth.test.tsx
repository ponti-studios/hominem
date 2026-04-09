import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { press, renderScreen } from './support/render';

const mockPasskeySignIn = jest.fn();
const mockAddPasskey = jest.fn();
const mockFetch = jest.fn();
const mockUseListPasskeys = jest.fn();
const mockDeleteFetch = jest.fn();
const originalFetch = globalThis.fetch;

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '18',
    select: (options: Record<string, unknown>) => options.ios ?? options.default,
  },
  Text: 'Text',
}));

jest.mock('~/constants', () => ({
  API_BASE_URL: 'http://localhost:4040',
  E2E_AUTH_SECRET: 'e2e-secret',
  E2E_TESTING: false,
}));

jest.mock('~/lib/auth-client', () => ({
  authClient: {
    signIn: {
      passkey: (...args: unknown[]) => mockPasskeySignIn(...args),
    },
    passkey: {
      addPasskey: (...args: unknown[]) => mockAddPasskey(...args),
    },
    useListPasskeys: (...args: unknown[]) => mockUseListPasskeys(...args),
    $fetch: (...args: unknown[]) => mockDeleteFetch(...args),
  },
}));

globalThis.fetch = mockFetch as unknown as typeof fetch;

import { useMobilePasskeyAuth } from '../utils/use-mobile-passkey-auth';

function Probe() {
  const passkey = useMobilePasskeyAuth();

  return (
    <>
      <Text testID="passkey-supported">{passkey.isSupported ? 'yes' : 'no'}</Text>
      <Text testID="passkey-loading">{passkey.isLoading ? 'yes' : 'no'}</Text>
      <Text testID="passkey-error">{passkey.error ?? ''}</Text>
      <Text testID="passkey-count">{String(passkey.passkeys.length)}</Text>
      <Text
        testID="passkey-sign-in"
        onPress={() => {
          void passkey.signIn().catch(() => undefined);
        }}
      >
        sign in
      </Text>
      <Text
        testID="passkey-add"
        onPress={() => {
          void passkey.addPasskey('My phone').catch(() => undefined);
        }}
      >
        add passkey
      </Text>
      <Text
        testID="passkey-delete"
        onPress={() => {
          void passkey.deletePasskey('pk_1').catch(() => undefined);
        }}
      >
        delete passkey
      </Text>
    </>
  );
}

describe('useMobilePasskeyAuth', () => {
  beforeEach(() => {
    mockPasskeySignIn.mockReset();
    mockAddPasskey.mockReset();
    mockFetch.mockReset();
    mockUseListPasskeys.mockReset();
    mockDeleteFetch.mockReset();

    mockUseListPasskeys.mockReturnValue({
      data: [],
      isPending: false,
      isRefetching: false,
    });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('reports support on iOS 16+', () => {
    renderScreen(<Probe />);
    expect(screen.getByTestId('passkey-supported')).toHaveTextContent('yes');
  });

  it('returns sign-in user data on successful passkey sign-in', async () => {
    mockPasskeySignIn.mockResolvedValue({
      data: {
        user: {
          id: 'pk-user-1',
          email: 'pk-user@hominem.test',
          name: 'Passkey User',
        },
      },
      error: null,
    });

    renderScreen(<Probe />);

    await press(screen.getByTestId('passkey-sign-in'));

    await waitFor(() => {
      expect(mockPasskeySignIn).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('passkey-error')).toHaveTextContent('');
    });
  });

  it('surfaces passkey sign-in errors', async () => {
    mockPasskeySignIn.mockResolvedValue({
      data: null,
      error: { message: 'Passkey sign-in failed upstream' },
    });

    renderScreen(<Probe />);

    await press(screen.getByTestId('passkey-sign-in'));

    await waitFor(() => {
      expect(screen.getByTestId('passkey-error')).toHaveTextContent(
        'Passkey sign-in failed upstream',
      );
    });
  });

  it('adds a passkey through the Better Auth client', async () => {
    mockAddPasskey.mockResolvedValue({ error: null });

    renderScreen(<Probe />);

    await press(screen.getByTestId('passkey-add'));

    await waitFor(() => {
      expect(mockAddPasskey).toHaveBeenCalledWith({ name: 'My phone' });
    });
  });

  it('deletes a passkey through the Better Auth fetch client', async () => {
    mockDeleteFetch.mockResolvedValue({ data: { success: true }, error: null });

    renderScreen(<Probe />);

    await press(screen.getByTestId('passkey-delete'));

    await waitFor(() => {
      expect(mockDeleteFetch).toHaveBeenCalledWith('/passkey/delete-passkey', {
        method: 'POST',
        body: { id: 'pk_1' },
        throw: false,
      });
    });
  });

  it('maps passkey list results to display names', () => {
    mockUseListPasskeys.mockReturnValue({
      data: [
        { id: 'pk_1', name: 'Laptop key' },
        { id: 'pk_2', name: null },
      ],
      isPending: false,
      isRefetching: false,
    });

    renderScreen(<Probe />);

    expect(screen.getByTestId('passkey-count')).toHaveTextContent('2');
  });
});
