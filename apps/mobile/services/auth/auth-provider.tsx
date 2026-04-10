import type { User } from '@hominem/auth';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type PropsWithChildren,
} from 'react';

import { useAuthHeaders, useResetAuthForE2E, useUpdateProfile } from '~/services/auth/hooks';
import { authStateMachine, initialAuthState } from '~/services/auth/types';
import { useBootSequence, useEmailOtp, usePasskeyAuth, useSignOut } from '~/services/auth/hooks';
import { resolveIsLoadingAuth, type AuthStatusCompat } from '~/services/auth/provider-utils';

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

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [state, dispatch] = useReducer(authStateMachine, initialAuthState);

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

  const authStatus = state.status;
  const authError = state.error;
  const isLoadingAuth = useMemo(() => resolveIsLoadingAuth(state), [state]);
  const isSignedIn = state.status === 'signed_in';
  const currentUser = useMemo(() => {
    if (!state.user) return null;
    return {
      id: state.user.id,
      email: state.user.email,
      name: state.user.name,
      image: state.user.image,
      emailVerified: state.user.emailVerified,
      createdAt: state.user.createdAt,
      updatedAt: state.user.updatedAt,
    };
  }, [state.user]);

  const value: AuthContextType = {
    authStatus,
    authError,
    isLoadingAuth,
    isSignedIn,
    currentUser,
    requestEmailOtp,
    verifyEmailOtp,
    completePasskeySignIn,
    signOut,
    updateProfile,
    getAuthHeaders,
    resetAuthForE2E,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};