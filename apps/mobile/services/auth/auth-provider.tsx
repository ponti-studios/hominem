import type { User } from '@hominem/auth/types';
import React, {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useCallback,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';

import { E2E_TESTING } from '~/constants';
import { createAuthContextSnapshot } from '~/services/auth/auth-provider-state';
import { useAuthHeaders } from '~/services/auth/hooks/use-auth-headers';
import { useBootSequence } from '~/services/auth/hooks/use-boot-sequence';
import { useEmailOtp } from '~/services/auth/hooks/use-email-otp';
import { usePasskeyAuth } from '~/services/auth/hooks/use-passkey-auth';
import { useResetAuthForE2E } from '~/services/auth/hooks/use-reset-auth-for-e2e';
import { useSignOut } from '~/services/auth/hooks/use-sign-out';
import { useUpdateProfile } from '~/services/auth/hooks/use-update-profile';
import { type AuthStatusCompat } from '~/services/auth/provider-utils';
import { authStateMachine, initialAuthState } from '~/services/auth/types';

type SignInResponse = {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
};

type AuthContextType = {
  authStatus: AuthStatusCompat;
  authError: Error | null;
  isLoadingAuth: boolean;
  isSignedIn: boolean;
  currentUser: User | null;
  requestEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (input: { email: string; otp: string; name?: string }) => Promise<void>;
  completePasskeySignIn: (input: SignInResponse) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<User>;
  getAuthHeaders: () => Promise<Record<string, string>>;
  resetAuthForE2E: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

function AuthProviderBody({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(authStateMachine, initialAuthState);
  const authSnapshot = useMemo(() => createAuthContextSnapshot(state), [state]);
  const sessionCookieHeaderRef = useRef<string | null>(null);

  const authContext = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  const { bootSession, abortControllerRef } = useBootSequence(authContext, sessionCookieHeaderRef);
  const { requestEmailOtp, verifyEmailOtp } = useEmailOtp(authContext, sessionCookieHeaderRef);
  const { completePasskeySignIn } = usePasskeyAuth(authContext, sessionCookieHeaderRef);
  const { signOut } = useSignOut(authContext, sessionCookieHeaderRef);

  const subscribeBootSession = useCallback(
    (_onStoreChange: () => void) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      void bootSession({ signal: controller.signal });

      return () => {
        controller.abort();
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      };
    },
    [abortControllerRef, bootSession],
  );

  useSyncExternalStore(
    subscribeBootSession,
    () => 0,
    () => 0,
  );

  const updateProfile = useUpdateProfile({ state, dispatch });
  const getAuthHeaders = useAuthHeaders(sessionCookieHeaderRef);
  const resetAuthForE2E = useResetAuthForE2E(dispatch);

  const value: AuthContextType = {
    ...authSnapshot,
    requestEmailOtp,
    verifyEmailOtp,
    completePasskeySignIn,
    signOut,
    updateProfile,
    getAuthHeaders,
    resetAuthForE2E,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function E2EAuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(authStateMachine, initialAuthState);

  const subscribeE2EInit = useCallback(
    (_onStoreChange: () => void) => {
      dispatch({ type: 'SESSION_EXPIRED' });
      return () => {};
    },
    [dispatch],
  );

  useSyncExternalStore(
    subscribeE2EInit,
    () => 0,
    () => 0,
  );

  const authContext = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  const authSnapshot = useMemo(() => createAuthContextSnapshot(state), [state]);
  const sessionCookieHeaderRef = useRef<string | null>(null);
  const { requestEmailOtp, verifyEmailOtp } = useEmailOtp(authContext, sessionCookieHeaderRef);
  const { completePasskeySignIn } = usePasskeyAuth(authContext, sessionCookieHeaderRef);
  const { signOut } = useSignOut(authContext, sessionCookieHeaderRef);
  const updateProfile = useUpdateProfile({ state, dispatch });
  const getAuthHeaders = useAuthHeaders(sessionCookieHeaderRef);
  const resetAuthForE2E = useResetAuthForE2E(dispatch);

  const value: AuthContextType = {
    ...authSnapshot,
    requestEmailOtp,
    verifyEmailOtp,
    completePasskeySignIn,
    signOut,
    updateProfile,
    getAuthHeaders,
    resetAuthForE2E,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const AuthProvider = ({ children }: PropsWithChildren) => {
  return E2E_TESTING ? (
    <E2EAuthProvider>{children}</E2EAuthProvider>
  ) : (
    <AuthProviderBody>{children}</AuthProviderBody>
  );
};
