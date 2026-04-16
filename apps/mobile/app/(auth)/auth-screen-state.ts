import type { AuthStatusCompat } from '~/services/auth/provider-utils';

export interface AuthScreenStateInput {
  authStatus: AuthStatusCompat;
  authError: string | null;
  passkeyError: string | null;
}

export interface AuthScreenStateOutput {
  isProbing: boolean;
  displayError: string | null;
}

export function resolveAuthScreenState(input: AuthScreenStateInput): AuthScreenStateOutput {
  return {
    isProbing: input.authStatus === 'booting',
    displayError: input.authError || input.passkeyError || null,
  };
}
