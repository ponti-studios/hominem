import type { User } from '@hominem/auth';

export type AuthStatus =
  | 'booting'
  | 'signed_out'
  | 'requesting_otp'
  | 'otp_requested'
  | 'verifying_otp'
  | 'authenticating_passkey'
  | 'signed_in'
  | 'signing_out'
  | 'degraded';

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
  | { type: 'PASSKEY_AUTH_STARTED' }
  | { type: 'PASSKEY_AUTH_FAILED'; error: Error }
  | { type: 'SIGN_OUT_REQUESTED' }
  | { type: 'SIGN_OUT_SUCCESS' }
  | { type: 'RESET_TO_SIGNED_OUT' }
  | { type: 'FATAL_ERROR'; error: Error }
  | { type: 'CLEAR_ERROR' };

export interface AuthContext {
  state: AuthState;
  dispatch: (event: AuthEvent) => void;
}

// Initial state
export const initialAuthState: AuthState = {
  status: 'booting',
  user: null,
  error: null,
  isLoading: false,
};

export function authStateMachine(state: AuthState, event: AuthEvent): AuthState {
  switch (event.type) {
    case 'SESSION_LOADED':
      return {
        ...state,
        status: 'signed_in',
        user: event.user,
        error: null,
        isLoading: false,
      };

    case 'SESSION_EXPIRED':
      return {
        ...state,
        status: 'signed_out',
        user: null,
        error: null,
        isLoading: false,
      };

    case 'SESSION_RECOVERY_FAILED':
      return {
        ...state,
        status: 'degraded',
        user: null,
        error: event.error,
        isLoading: false,
      };

    case 'OTP_REQUEST_STARTED':
      return {
        ...state,
        status: 'requesting_otp',
        isLoading: true,
        error: null,
      };

    case 'OTP_REQUESTED':
      return {
        ...state,
        status: 'otp_requested',
        isLoading: false,
        error: null,
      };

    case 'OTP_REQUEST_FAILED':
      return {
        ...state,
        status: 'degraded',
        error: event.error,
        isLoading: false,
      };

    case 'OTP_VERIFICATION_STARTED':
      return {
        ...state,
        status: 'verifying_otp',
        error: null,
        isLoading: true,
      };

    case 'PASSKEY_AUTH_STARTED':
      return {
        ...state,
        status: 'authenticating_passkey',
        error: null,
        isLoading: true,
      };

    case 'PASSKEY_AUTH_FAILED':
      return {
        ...state,
        status: 'degraded',
        error: event.error,
        isLoading: false,
      };

    case 'OTP_VERIFICATION_FAILED':
      return {
        ...state,
        status: 'otp_requested',
        error: event.error,
        isLoading: false,
      };

    case 'SIGN_OUT_REQUESTED':
      return {
        ...state,
        status: 'signing_out',
        isLoading: true,
        error: null,
      };

    case 'SIGN_OUT_SUCCESS':
      return {
        ...state,
        status: 'signed_out',
        user: null,
        error: null,
        isLoading: false,
      };

    case 'RESET_TO_SIGNED_OUT':
      return {
        ...state,
        status: 'signed_out',
        user: null,
        error: null,
        isLoading: false,
      };

    case 'FATAL_ERROR':
      return {
        ...state,
        status: 'degraded',
        error: event.error,
        isLoading: false,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
        status: state.status === 'degraded' ? 'signed_out' : state.status,
      };

    default:
      return state;
  }
}
