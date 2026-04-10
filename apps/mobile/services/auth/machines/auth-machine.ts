import type { AuthState, AuthEvent } from './types';

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

    case 'API_TOKEN_MINT_STARTED':
      return {
        ...state,
        status: 'minting_api_token',
        error: null,
        isLoading: true,
      };

    case 'API_TOKEN_MINT_FAILED':
      return {
        ...state,
        status: 'degraded',
        error: event.error,
        isLoading: false,
      };

    case 'PROFILE_SYNC_STARTED':
      return {
        ...state,
        status: 'syncing_profile',
        error: null,
        isLoading: true,
      };

    case 'REFRESH_STARTED':
      return {
        ...state,
        status: 'refreshing_session',
        error: null,
        isLoading: true,
      };

    case 'REFRESH_FAILED':
      return {
        ...state,
        status: 'signed_out',
        error: event.error,
        isLoading: false,
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

    case 'SYNC_STARTED':
      return {
        ...state,
        isLoading: true,
      };

    case 'SYNC_COMPLETED':
      return {
        ...state,
        isLoading: false,
        error: null,
      };

    case 'SYNC_FAILED':
      return {
        ...state,
        status: 'degraded',
        error: event.error,
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
        status: 'terminal_error',
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
