import type { StepUpAction } from '../shared/step-up-actions';

export const STEP_UP_TTL_SECONDS = 5 * 60;


/**
 * Minimal Redis-compatible interface for step-up token storage.
 * Inject your Redis client at startup via `configureStepUpStore`.
 */
interface StepUpStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<string | null>;
}

let stepUpStore: StepUpStore | null = null;

export function configureStepUpStore(store: StepUpStore) {
  stepUpStore = store;
}


function getStepUpKey(userId: string, action: StepUpAction) {
  return `auth:stepup:${userId}:${action}`;
}


export async function grantStepUp(userId: string, action: StepUpAction) {
  if (!stepUpStore) throw new Error('step-up store not configured');
  await stepUpStore.set(getStepUpKey(userId, action), '1', 'EX', STEP_UP_TTL_SECONDS);
}

export async function hasRecentStepUp(userId: string, action: StepUpAction) {
  if (!stepUpStore) return false;
  return (await stepUpStore.get(getStepUpKey(userId, action))) === '1';
}

/**
 * Returns true if the session was authenticated via passkey within the
 * step-up TTL window. Use as an alternative to Redis-backed step-up for
 * passkey-native flows.
 */
export function isFreshPasskeyAuth(input: {
  amr: string[] | undefined;
  authTime: number | null | undefined;
  nowMs?: number;
}) {
  if (!input.amr?.includes('passkey')) return false;
  if (!input.authTime) return false;
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  return nowSeconds - input.authTime <= STEP_UP_TTL_SECONDS;
}
