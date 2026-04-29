import { expoClient } from '@better-auth/expo/client';
import { passkeyClient } from '@better-auth/passkey/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { API_BASE_URL, APP_SCHEME } from '~/constants';

function getAuthOriginHeader() {
  return new URL(API_BASE_URL).origin;
}

type AuthError = {
  message?: string;
};

export type AuthResult<TData = never> = {
  data?: TData | null;
  error?: AuthError | null;
};

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  fetchOptions: {
    headers: {
      Origin: getAuthOriginHeader(),
    },
  },
  plugins: [
    expoClient({
      scheme: APP_SCHEME,
      storage: SecureStore,
      storagePrefix: 'hominem',
    }),
    emailOTPClient(),
    passkeyClient(),
  ],
});
