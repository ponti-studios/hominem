import { db } from '@hominem/db';

import type { Session, User } from './types';

interface AuthConfig {
  apiBaseUrl: string;
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
      return {
        user: testUser,
        session: {
          id: 'test-session',
          token: 'test-session',
          userId: testUser.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          ipAddress: null,
          userAgent: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } satisfies Session,
        headers: new Headers(),
      };
    }
  }

  if (cookie) {
    headers.set('cookie', cookie);
  }

  const response = await fetch(new URL('/api/auth/get-session', config.apiBaseUrl).toString(), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    return { user: null, session: null, headers: new Headers() };
  }

  const payload = (await response.json()) as { user: User; session: Session } | null;
  return {
    user: payload?.user ?? null,
    session: payload?.session ?? null,
    headers: new Headers(),
  };
}

// ---------------------------------------------------------------------------
// UserAuthService
// ---------------------------------------------------------------------------

interface FindUserInput {
  id: string;
}

type UserRecord = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const UserAuthService = {
  async findByIdOrEmail(input: FindUserInput): Promise<UserRecord | null> {
    const row = await db
      .selectFrom('user')
      .selectAll()
      .where((eb) => eb.or([eb('id', '=', input.id), eb('email', '=', input.id)]))
      .executeTakeFirst();

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      emailVerified: row.emailVerified ?? false,
      name: row.name ?? '',
      image: row.image,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },
};

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
