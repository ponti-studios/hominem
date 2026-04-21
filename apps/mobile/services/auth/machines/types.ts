import type { User } from '@hakumi/auth/types';

export type AuthStatus =
  | 'booting'
  | 'signed_out'
  | 'requesting_otp'
  | 'otp_requested'
  | 'verifying_otp'
  | 'minting_api_token'
  | 'syncing_profile'
  | 'authenticating_passkey'
  | 'refreshing_session'
  | 'signed_in'
  | 'signing_out'
  | 'degraded'
  | 'terminal_error';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: Error | null;
  isLoading: boolean;
}

export type AuthEvent =
  | { type: 'SESSION_LOADED'; user: User }
  | { type: 'SESSION_EXPIRED' }
  | { type: 'SESSION_RECOVERY_FAILED'; error: Error }
  | { type: 'OTP_REQUEST_STARTED' }
  | { type: 'OTP_REQUESTED' }
  | { type: 'OTP_REQUEST_FAILED'; error: Error }
  | { type: 'OTP_VERIFICATION_STARTED' }
  | { type: 'OTP_VERIFICATION_FAILED'; error: Error }
  | { type: 'API_TOKEN_MINT_STARTED' }
  | { type: 'API_TOKEN_MINT_FAILED'; error: Error }
  | { type: 'PROFILE_SYNC_STARTED' }
  | { type: 'PASSKEY_AUTH_STARTED' }
  | { type: 'PASSKEY_AUTH_FAILED'; error: Error }
  | { type: 'REFRESH_STARTED' }
  | { type: 'REFRESH_FAILED'; error: Error }
  | { type: 'SIGN_OUT_REQUESTED' }
  | { type: 'SIGN_OUT_SUCCESS' }
  | { type: 'SYNC_STARTED' }
  | { type: 'SYNC_COMPLETED' }
  | { type: 'SYNC_FAILED'; error: Error }
  | { type: 'RESET_TO_SIGNED_OUT' }
  | { type: 'FATAL_ERROR'; error: Error }
  | { type: 'CLEAR_ERROR' };

export interface AuthContext {
  state: AuthState;
  dispatch: (event: AuthEvent) => void;
}

export const initialAuthState: AuthState = {
  status: 'booting',
  user: null,
  error: null,
  isLoading: false,
};
