import { expoClient } from '@better-auth/expo/client';
import { passkeyClient } from '@better-auth/passkey/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { API_BASE_URL, APP_SCHEME } from '~/constants';

type AuthError = {
  message?: string;
};

type AuthResult<TData = never> = {
  data?: TData | null;
  error?: AuthError | null;
};

const baseAuthClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [
    expoClient({
      scheme: APP_SCHEME,
      storage: SecureStore,
      storagePrefix: 'hakumi',
    }),
    emailOTPClient(),
    passkeyClient(),
  ],
});

export const authClient: typeof baseAuthClient & {
  deletePasskey: (input: { id: string }) => Promise<AuthResult>;
} = Object.assign(baseAuthClient, {
  deletePasskey: ({ id }: { id: string }): Promise<AuthResult> => {
    return baseAuthClient.$fetch('/passkey/delete-passkey', {
      method: 'POST',
      body: { id },
      throw: false,
    }) as Promise<AuthResult>;
  },
});
