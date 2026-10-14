import { logger } from '@hominem/telemetry';
import type { AuthUser as User } from '@ponti-studios/auth/types';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import type { HominemAuthUser } from '~/modules/hominem-auth-bridge';
import { authClient } from '~/services/auth/auth-client';
import { clearLegacyDataOnce } from '~/services/auth/boot-legacy-data';
import { clearLocalSessionState } from '~/services/auth/clear-local-session-state';
import { useAuthHeaders } from '~/services/auth/hooks/use-auth-headers';
import { useEmailOtp } from '~/services/auth/hooks/use-email-otp';
import { useResetAuthForE2E } from '~/services/auth/hooks/use-reset-auth-for-e2e';
import { useSignOut } from '~/services/auth/hooks/use-sign-out';
import { useUpdateProfile } from '~/services/auth/hooks/use-update-profile';
import queryClient from '~/services/query-client';

type AuthContextType = {
  isPending: boolean;
  isSignedIn: boolean;
  isSigningOut: boolean;
  currentUser: User | null;
  requestEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (input: { email: string; otp: string; name?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  getAuthHeaders: () => Promise<Record<string, string>>;
  handleUnauthorized: () => Promise<void>;
  resetAuthForE2E: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};

function toUser(sessionUser: HominemAuthUser): User {
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    name: sessionUser.name ?? '',
    image: sessionUser.image ?? null,
    emailVerified: sessionUser.emailVerified ?? false,
    createdAt: new Date(sessionUser.createdAt ?? 0).toISOString(),
    updatedAt: new Date(sessionUser.updatedAt ?? 0).toISOString(),
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [sessionUser, setSessionUser] = useState<HominemAuthUser | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const hasRunLegacyMigrationRef = useRef(false);

  const currentUser = useMemo(() => (sessionUser ? toUser(sessionUser) : null), [sessionUser]);
  const isSignedIn = Boolean(currentUser) && !isSigningOut;

  const onAuthenticated = useCallback((user: HominemAuthUser) => setSessionUser(user), []);
  const { requestEmailOtp, verifyEmailOtp } = useEmailOtp(onAuthenticated);
  const updateProfileRequest = useUpdateProfile();
  const updateProfile = useCallback(
    async (updates: Partial<User>) => {
      const user = await updateProfileRequest(updates);
      setSessionUser(user);
    },
    [updateProfileRequest],
  );
  const getAuthHeaders = useAuthHeaders();
  const resetAuth = useResetAuthForE2E();
  const runSignOut = useSignOut(currentUser?.email);

  useEffect(() => {
    if (hasRunLegacyMigrationRef.current) {
      return;
    }
    hasRunLegacyMigrationRef.current = true;
    void clearLegacyDataOnce();
  }, []);

  const resetAuthForE2E = useCallback(async () => {
    await resetAuth();
    setSessionUser(null);
  }, [resetAuth]);

  useEffect(() => {
    let active = true;
    void authClient
      .getSession()
      .then((user) => {
        if (active) {
          setSessionUser(user);
        }
      })
      .catch((error) => logger.warn('[AuthProvider] Session restore failed', { error }))
      .finally(() => {
        if (active) {
          setIsPending(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await runSignOut();
    } finally {
      setSessionUser(null);
      setIsSigningOut(false);
    }
  }, [runSignOut]);

  const handleUnauthorized = useCallback(async () => {
    await authClient
      .signOut()
      .catch((error) => logger.warn('[AuthProvider] Best-effort sign-out failed', { error }));
    await clearLocalSessionState(queryClient);
    setSessionUser(null);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      isPending,
      isSignedIn,
      isSigningOut,
      currentUser,
      requestEmailOtp,
      verifyEmailOtp,
      signOut,
      updateProfile,
      getAuthHeaders,
      handleUnauthorized,
      resetAuthForE2E,
    }),
    [
      isPending,
      isSignedIn,
      isSigningOut,
      currentUser,
      requestEmailOtp,
      verifyEmailOtp,
      signOut,
      updateProfile,
      getAuthHeaders,
      handleUnauthorized,
      resetAuthForE2E,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
