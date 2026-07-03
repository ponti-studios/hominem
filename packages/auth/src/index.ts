export { AuthProvider, useAuthClient, useSession } from './client/provider';
export type { } from './types';

import { useSession, useAuthClient } from './client/provider';

/**
 * Compatibility hook for legacy useAuthContext API.
 * Returns { user, isLoading, session, userId, authClient }.
 */
export function useAuthContext() {
  const { data: session, isPending: isLoading } = useSession();
  const authClient = useAuthClient();

  return {
    user: session?.user ?? null,
    session: session?.session ?? null,
    userId: session?.user?.id ?? null,
    isLoading,
    authClient,
    logout: async () => {
      await authClient.signOut();
    },
  };
}

/**
 * Compatibility hook — returns auth context or null if not inside AuthProvider.
 * Use this in optional auth contexts.
 */
export function useSafeAuth() {
  try {
    return useAuthContext();
  } catch {
    return null;
  }
}
