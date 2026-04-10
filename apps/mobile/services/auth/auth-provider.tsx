import type { User } from '@hominem/auth';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type PropsWithChildren,
} from 'react';

import { E2E_TESTING } from '~/constants';
import { useAuthHeaders, useResetAuthForE2E, useUpdateProfile } from '~/services/auth/hooks';
import { authStateMachine, initialAuthState } from '~/services/auth/types';
import { useBootSequence, useEmailOtp, usePasskeyAuth, useSignOut } from '~/services/auth/hooks';
import { type AuthStatusCompat } from '~/services/auth/provider-utils';
import { createAuthContextSnapshot } from '~/services/auth/auth-provider-state';

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

  const authContext = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  const { sessionCookieHeaderRef, bootSession, abortControllerRef } = useBootSequence(authContext);
  const { requestEmailOtp, verifyEmailOtp } = useEmailOtp(authContext);
  const { completePasskeySignIn } = usePasskeyAuth(authContext);
  const { signOut } = useSignOut(authContext);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [abortControllerRef]);

  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    void bootSession({ signal: controller.signal });

    return () => {
      controller.abort();
    };
  }, [bootSession, abortControllerRef]);

  const updateProfile = useUpdateProfile();
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

  useEffect(() => {
    dispatch({ type: 'SESSION_EXPIRED' });
  }, []);

  const authContext = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  const authSnapshot = useMemo(() => createAuthContextSnapshot(state), [state]);
  const { requestEmailOtp, verifyEmailOtp } = useEmailOtp(authContext);
  const { completePasskeySignIn } = usePasskeyAuth(authContext);
  const { signOut } = useSignOut(authContext);
  const updateProfile = useUpdateProfile();
  const sessionCookieHeaderRef = useRef<string | null>(null);
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
  return E2E_TESTING ? <E2EAuthProvider>{children}</E2EAuthProvider> : <AuthProviderBody>{children}</AuthProviderBody>;
};
