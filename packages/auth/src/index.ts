import type { User, Session } from 'better-auth';

export { AuthProvider, useAuthClient, useSession } from './client/provider';

import { useAuthClient, useSession } from './client/provider';

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  userId: string | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

/**
 * Compatibility hook for legacy useAuthContext API.
 * Returns { user, isLoading, session, userId, authClient }.
 */
export function useAuthContext(): AuthContextValue {
  const { data: session, isPending: isLoading } = useSession();
  const authClient = useAuthClient();

  return {
    user: (session?.user ?? null) as User | null,
    session: (session?.session ?? null) as Session | null,
    userId: session?.user?.id ?? null,
    isLoading,
    logout: async () => {
      await authClient.signOut();
    },
  };
}

/**
 * Compatibility hook — returns auth context or null if not inside AuthProvider.
 * Use this in optional auth contexts.
 */
export function useSafeAuth(): AuthContextValue | null {
  try {
    return useAuthContext();
  } catch {
    return null;
  }
}
