import { ZodError } from 'zod';

import { GoogleAuthError } from './google.js';

// The outcome of a token check. `dead` needs a human to sign in again; `unreachable` means we
// couldn't tell (offline, Google having a bad moment), so it must not raise the alarm.
export type Health =
  | { status: 'healthy' }
  | { status: 'dead'; reason: string }
  | { status: 'unreachable'; reason: string };

const DEAD_CODES = new Set<GoogleAuthError['code']>([
  'TOKEN_MISSING',
  'TOKEN_REVOKED',
  'API_UNAUTHORIZED',
]);

export function healthFromError(error: unknown): Health {
  if (error instanceof GoogleAuthError) {
    return DEAD_CODES.has(error.code)
      ? { status: 'dead', reason: error.message }
      : { status: 'unreachable', reason: error.message };
  }
  // A token file we can't parse won't fix itself: sign in again.
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return { status: 'dead', reason: 'The token file is unreadable.' };
  }
  return { status: 'unreachable', reason: error instanceof Error ? error.message : String(error) };
}

// 0 healthy, 1 dead, 2 couldn't check.
export function exitCodeFor(health: Health): number {
  return health.status === 'healthy' ? 0 : health.status === 'dead' ? 1 : 2;
}

export function shouldNotify(health: Health): boolean {
  return health.status === 'dead';
}

export function describeHealth(health: Health): string[] {
  switch (health.status) {
    case 'healthy':
      return ['Google auth: healthy'];
    case 'dead':
      return [`Google auth: dead (${health.reason})`, 'Run `hominem auth google` to sign back in.'];
    case 'unreachable':
      return [`Google auth: could not check (${health.reason})`];
  }
}
