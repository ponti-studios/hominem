import { passkeyClient } from '@better-auth/passkey/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import type { Session, User } from '../types';

export type AuthError = {
  message?: string;
};

export type AuthResult<TData = unknown> = {
  data?: TData | null;
  error?: AuthError | null;
};

type PasskeyRecord = {
  id: string;
  name?: string | null;
  createdAt?: string | Date | null;
};

export interface SessionHookResult {
  data?: { user: User; session: Session } | null;
  error?: AuthError | null;
  isPending: boolean;
  isRefetching: boolean;
  refetch: () => unknown;
}

export interface AuthClient {
  emailOtp: {
    sendVerificationOtp: (input: {
      email: string;
      type: string;
      fetchOptions?: { signal?: AbortSignal };
    }) => Promise<AuthResult>;
  };
  signIn: {
    emailOtp: (input: {
      email: string;
      otp: string;
      name?: string;
      fetchOptions?: { signal?: AbortSignal };
    }) => Promise<AuthResult<{ user?: User | null; session?: Session | null }>>;
    passkey: () => Promise<AuthResult<{ user?: User | null; session?: Session | null }>>;
  };
  passkey: {
    addPasskey: (input?: { name?: string }) => Promise<AuthResult>;
  };
  signOut: () => Promise<AuthResult>;
  useListPasskeys: () => {
    data?: PasskeyRecord[] | null;
    error?: AuthError | null;
    isPending: boolean;
    isRefetching: boolean;
    refetch: () => unknown;
  };
  useSession: () => SessionHookResult;
  $fetch: (
    path: string,
    input: {
      method: string;
      body?: unknown;
      throw?: boolean;
    },
  ) => Promise<AuthResult>;
}

const authClientCache = new Map<string, AuthClient>();

function createBrowserAuthClient(apiBaseUrl: string): AuthClient {
  return createAuthClient({
    baseURL: apiBaseUrl,
    plugins: [emailOTPClient(), passkeyClient()],
  }) as AuthClient;
}

export function getAuthClient(apiBaseUrl: string): AuthClient {
  let client = authClientCache.get(apiBaseUrl);
  if (!client) {
    client = createBrowserAuthClient(apiBaseUrl);
    authClientCache.set(apiBaseUrl, client);
  }
  return client;
}
