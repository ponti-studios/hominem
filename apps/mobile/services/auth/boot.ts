import type { AuthState } from './types';

export interface AuthBootStoredTokens {
  sessionCookieHeader: string | null;
}

export interface AuthBootStoredSnapshot {
  sessionCookieHeader: string;
  user: NonNullable<AuthState['user']>;
}

export interface AuthBootUser {
  id: string;
  email: string;
  name?: string | null;
}

type AuthBootResult =
  | {
      type: 'SESSION_LOADED';
      user: NonNullable<AuthState['user']>;
      tokens: { sessionCookieHeader: string };
    }
  | { type: 'SESSION_EXPIRED' };

export interface AuthBootDeps {
  getStoredTokens: () => Promise<AuthBootStoredTokens>;
  getStoredProfile: () => Promise<NonNullable<AuthState['user']> | null>;
  probeSession: (input: {
    sessionCookieHeader: string | null;
    signal: AbortSignal;
  }) => Promise<{ user: AuthBootUser } | null>;
  clearTokens: () => Promise<void>;
  upsertProfile: (user: AuthBootUser) => Promise<NonNullable<AuthState['user']> | null>;
  clearLegacyData: () => Promise<void>;
  signal: AbortSignal;
}

export async function restoreStoredSessionSnapshot(
  deps: Pick<AuthBootDeps, 'clearLegacyData' | 'getStoredProfile' | 'getStoredTokens'>,
): Promise<AuthBootStoredSnapshot | null> {
  const { clearLegacyData, getStoredProfile, getStoredTokens } = deps;

  await clearLegacyData();

  const [{ sessionCookieHeader }, user] = await Promise.all([
    getStoredTokens(),
    getStoredProfile(),
  ]);

  if (!sessionCookieHeader || !user) {
    return null;
  }

  return {
    sessionCookieHeader,
    user,
  };
}

export async function runAuthBoot(deps: AuthBootDeps): Promise<AuthBootResult> {
  const { getStoredTokens, probeSession, clearTokens, upsertProfile, clearLegacyData, signal } =
    deps;

  await clearLegacyData();

  const { sessionCookieHeader } = await getStoredTokens();

  if (sessionCookieHeader) {
    const probeResult = await probeSession({
      sessionCookieHeader,
      signal,
    });

    if (probeResult) {
      const userProfile = await upsertProfile(probeResult.user);
      if (userProfile) {
        return {
          type: 'SESSION_LOADED',
          user: userProfile,
          tokens: { sessionCookieHeader },
        };
      }
    } else {
      await clearTokens();
    }
  }

  return { type: 'SESSION_EXPIRED' };
}
