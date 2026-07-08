import type { User } from './types';

interface AuthConfig {
  apiBaseUrl: string;
}

interface SessionPayload {
  isAuthenticated: boolean;
  user: User | null;
}

function getTestAuthUser(cookieHeader: string | null): User | null {
  const testAuthCookie = cookieHeader
    ?.split(';')
    .find((cookie) => cookie.trim().startsWith('test-auth-user='))
    ?.split('=')[1];
  if (!testAuthCookie) return null;
  try {
    return JSON.parse(decodeURIComponent(testAuthCookie)) as User;
  } catch {
    return null;
  }
}

export async function getServerAuth(request: Request, config: AuthConfig) {
  const headers = new Headers();
  const cookie = request.headers.get('cookie');

  if (process.env.NODE_ENV !== 'production') {
    const testUser = getTestAuthUser(cookie);
    if (testUser) {
      return { user: testUser, headers: new Headers() };
    }
  }

  if (cookie) {
    headers.set('cookie', cookie);
  }

  const response = await fetch(new URL('/api/auth/session', config.apiBaseUrl).toString(), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    return { user: null, headers: new Headers() };
  }

  const payload = (await response.json()) as SessionPayload | null;
  return {
    user: payload?.isAuthenticated ? (payload.user ?? null) : null,
    headers: new Headers(),
  };
}

// ---------------------------------------------------------------------------
// Step-up helpers (Redis-backed)
// ---------------------------------------------------------------------------

type RedisClient = {
  set: (key: string, value: string, mode?: string, ttl?: number) => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<unknown>;
};

let stepUpStoreClient: RedisClient | null = null;

function stepUpKey(userId: string, action: string): string {
  return `step-up:${action}:${userId}`;
}

const STEP_UP_TTL_SECONDS = 300; // 5 minutes

export function configureStepUpStore(redisClient: RedisClient): void {
  stepUpStoreClient = redisClient;
}

export async function grantStepUp(userId: string, action: string): Promise<void> {
  if (!stepUpStoreClient) return;
  await stepUpStoreClient.set(stepUpKey(userId, action), 'granted', 'EX', STEP_UP_TTL_SECONDS);
}

export async function hasRecentStepUp(userId: string, action: string): Promise<boolean> {
  if (!stepUpStoreClient) return false;
  const value = await stepUpStoreClient.get(stepUpKey(userId, action));
  return value === 'granted';
}

interface FreshPasskeyAuthInput {
  amr?: string[];
  authTime?: number;
}

const PASSKEY_METHOD = 'passkey';

/**
 * Returns true when the access-token AMR includes "passkey" AND the
 * auth_time is within the step-up TTL window.
 */
export function isFreshPasskeyAuth(input: FreshPasskeyAuthInput): boolean {
  if (!input.amr?.includes(PASSKEY_METHOD)) return false;
  if (!input.authTime) return false;

  const ageSeconds = Math.floor(Date.now() / 1000) - input.authTime;
  return ageSeconds < STEP_UP_TTL_SECONDS;
}
