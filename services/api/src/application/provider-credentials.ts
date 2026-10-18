/**
 * Per-person, per-device provider (OpenRouter) credentials for Thames.
 *
 * The rules (docs/prd/user-credentials.md in the Thames repo):
 * - a person has one monthly budget across ALL their keys, revoked ones included, so a
 *   replacement key can never refill a spent budget;
 * - a key's limit is min(cap / DEVICE_LIMIT, what is left of the budget), so the limits of
 *   the live keys never add up to more than the cap;
 * - a blocked person can never mint; the allow-list gates minting only (sign-in stays open
 *   for the other apps);
 * - the server keeps only a key's hash, never the key.
 *
 * Everything here talks to the outside through two small ports, so the rules are tested
 * without a database or OpenRouter.
 */

import {
  creditSnapshot,
  ensureGrant,
  newKeyLimitUsd,
  reconcileLimits,
  type CreditDeps,
} from './credit';

export const DEVICE_LIMIT = 3;
export const MINTS_PER_HOUR = 5;
/** A grant smaller than this is not worth a key; the person is treated as out of budget. */
export const MIN_GRANT_USD = 0.05;
/** The same floor in credit mode, where the balance is in pence and can be small but real. */
export const MIN_CREDIT_GRANT_USD = 0.01;

export interface CredentialRow {
  id: string;
  userId: string;
  deviceId: string;
  keyHash: string;
  /** 'YYYY-MM' (UTC) of the budget this key was granted from. */
  period: string;
  limitUsd: number;
  createdAt: Date;
  revokedAt: Date | null;
  disabledAt: Date | null;
}

export type NewCredential = Pick<
  CredentialRow,
  'userId' | 'deviceId' | 'keyHash' | 'period' | 'limitUsd' | 'createdAt'
>;

export interface CredentialStore {
  isBlocked(userId: string): Promise<boolean>;
  isAllowed(email: string): Promise<boolean>;
  rows(userId: string): Promise<CredentialRow[]>;
  /** In one transaction: end the rows with these hashes, then insert the new one. */
  replace(input: { revokeHashes: string[]; insert: NewCredential; at: Date }): Promise<void>;
  markRevoked(keyHash: string, at: Date): Promise<void>;
  markDisabled(keyHash: string, at: Date): Promise<void>;
}

export interface KeysClient {
  create(input: { name: string; limitUsd: number }): Promise<{ key: string; hash: string }>;
  disable(hash: string): Promise<void>;
  /** What the key has spent this calendar month, in USD. */
  usageMonthly(hash: string): Promise<number>;
}

export interface CredentialDeps {
  store: CredentialStore;
  keys: KeysClient;
  capUsd: number;
  now?: () => Date;
  log?: (event: string, fields: Record<string, unknown>) => void;
  /** Present only for a person in credit mode: the balance then replaces the monthly budget. */
  credit?: CreditDeps;
}

export type MintOutcome =
  | { kind: 'minted'; key: string; hash: string; limitUsd: number }
  | { kind: 'not_listed' }
  | { kind: 'blocked' }
  | { kind: 'capped' }
  | { kind: 'rate_limited' };

export function periodOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function floor4(value: number): number {
  return Math.floor(value * 10_000) / 10_000;
}

export async function mintCredential(
  deps: CredentialDeps,
  input: { userId: string; email: string; deviceId: string },
): Promise<MintOutcome> {
  const { store, keys } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const period = periodOf(now);

  if (await store.isBlocked(input.userId)) return { kind: 'blocked' };
  if (!(await store.isAllowed(input.email.trim().toLowerCase()))) return { kind: 'not_listed' };

  const rows = await store.rows(input.userId);
  const hourAgo = now.getTime() - 60 * 60 * 1000;
  if (rows.filter((row) => row.createdAt.getTime() > hourAgo).length >= MINTS_PER_HOUR) {
    return { kind: 'rate_limited' };
  }

  const live = rows.filter((row) => row.revokedAt === null);
  const replaced = live.filter((row) => row.deviceId === input.deviceId);
  const others = live
    .filter((row) => row.deviceId !== input.deviceId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  // A new device beyond the limit ends the oldest other device's key.
  const evicted =
    others.length >= DEVICE_LIMIT ? others.slice(0, others.length - DEVICE_LIMIT + 1) : [];
  const kept = others.filter((row) => !evicted.includes(row));

  let grant: number;
  if (deps.credit) {
    // Credit mode: the balance, not the month, decides. The free credit is given on first use.
    await ensureGrant(deps.credit, input.userId);
    const snapshot = await creditSnapshot(deps.credit, input.userId);
    grant = newKeyLimitUsd(snapshot.balancePence, deps.credit.config.usdPerPound, kept.length + 1);
    if (snapshot.balancePence <= 0 || grant < MIN_CREDIT_GRANT_USD) return { kind: 'capped' };
  } else {
    // Spend counts every key of this month, revoked or not. Unspent allowance on the keys that
    // stay is already promised, so it comes off what is left.
    const thisMonth = keysCountingThisMonth(rows, now);
    const usage = new Map<string, number>();
    for (const row of thisMonth) usage.set(row.keyHash, await keys.usageMonthly(row.keyHash));
    const spent = [...usage.values()].reduce((sum, value) => sum + value, 0);
    const promised = kept
      .filter((row) => row.period === period)
      .reduce((sum, row) => sum + Math.max(0, row.limitUsd - (usage.get(row.keyHash) ?? 0)), 0);
    const remaining = deps.capUsd - spent - promised;
    grant = floor4(Math.min(deps.capUsd / DEVICE_LIMIT, remaining));
    if (grant < MIN_GRANT_USD) return { kind: 'capped' };
  }

  const created = await keys.create({
    name: `thames:${input.userId}:${input.deviceId}`,
    limitUsd: grant,
  });
  const ended = [...replaced, ...evicted];
  try {
    await store.replace({
      revokeHashes: ended.map((row) => row.keyHash),
      insert: {
        userId: input.userId,
        deviceId: input.deviceId,
        keyHash: created.hash,
        period,
        limitUsd: grant,
        createdAt: now,
      },
      at: now,
    });
  } catch (error) {
    // The new key must not outlive a row that does not exist.
    await keys.disable(created.hash).catch(() => undefined);
    throw error;
  }
  await disableAll(
    deps,
    ended.map((row) => row.keyHash),
  );
  if (deps.credit) {
    // Keep the live keys' limits adding up to the balance now that the set of keys changed. If a
    // retained key's limit cannot be lowered, the new key would make the limits add up to more
    // than the balance, so it is ended and not released.
    try {
      await reconcileLimits(deps.credit, await creditSnapshot(deps.credit, input.userId), {
        strict: true,
      });
    } catch (error) {
      deps.log?.('credit_reconcile_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      await keys.disable(created.hash).catch(() => undefined);
      await store.markRevoked(created.hash, now);
      await store.markDisabled(created.hash, now).catch(() => undefined);
      return { kind: 'capped' };
    }
  }
  return { kind: 'minted', key: created.key, hash: created.hash, limitUsd: grant };
}

/** Reading the budget took too long or the provider could not answer: no partial total is given. */
export class BudgetUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetUnavailableError';
  }
}

/** How many usage reads run at once, and how long the whole calculation may take. */
export const USAGE_CONCURRENCY = 5;
export const BUDGET_DEADLINE_MS = 8_000;

/**
 * The keys whose usage counts toward this month: those granted this month, those still live
 * (a key made last month can keep spending after the month turns over, and the provider's
 * monthly usage is this month's), and those revoked since the month began.
 */
export function keysCountingThisMonth(rows: CredentialRow[], now: Date): CredentialRow[] {
  const period = periodOf(now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return rows.filter(
    (row) =>
      row.period === period ||
      row.revokedAt === null ||
      row.revokedAt.getTime() >= monthStart.getTime(),
  );
}

/** Reads each key's usage, a few at a time, and gives up as a whole after the deadline. */
async function usageOf(deps: CredentialDeps, hashes: string[]): Promise<number> {
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      reject(new BudgetUnavailableError('Reading usage took too long'));
    }, BUDGET_DEADLINE_MS);
  });
  let next = 0;
  let total = 0;
  const worker = async () => {
    while (!expired && next < hashes.length) {
      const hash = hashes[next++]!;
      // Read the answer first: `total += await …` would use a total from before other workers added theirs.
      const used = await deps.keys.usageMonthly(hash);
      total += used;
    }
  };
  const work = Promise.all(
    Array.from({ length: Math.min(USAGE_CONCURRENCY, hashes.length) }, worker),
  );
  try {
    await Promise.race([work, deadline]);
    return total;
  } finally {
    clearTimeout(timer);
    // A read still running after the deadline finishes on its own; its result is not used.
    work.catch(() => undefined);
  }
}

export interface Budget {
  /** The person's whole monthly budget. */
  capUsd: number;
  /** What all their keys have spent this month, as OpenRouter reports it (minutes late). */
  spentUsd: number;
  remainingUsd: number;
  /** When the budget starts again: the first of next month, UTC. */
  resetsAt: string;
  /** When this was read. */
  asOf: string;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * What a person has used of their monthly budget: every key of this month, revoked ones
 * included, the same sum a new key's grant is taken from. OpenRouter reports usage a few
 * minutes late, so this can lag what was just spent.
 */
export async function budgetFor(deps: CredentialDeps, userId: string): Promise<Budget> {
  const now = (deps.now ?? (() => new Date()))();
  const rows = keysCountingThisMonth(await deps.store.rows(userId), now);
  const spent = await usageOf(
    deps,
    rows.map((row) => row.keyHash),
  );
  return {
    capUsd: deps.capUsd,
    spentUsd: round4(spent),
    remainingUsd: round4(Math.max(0, deps.capUsd - spent)),
    resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
    asOf: now.toISOString(),
  };
}

/** Ends one device's key for this person. False when they have no live key for that device. */
export async function revokeCredential(
  deps: CredentialDeps,
  input: { userId: string; deviceId: string },
): Promise<boolean> {
  const now = (deps.now ?? (() => new Date()))();
  const rows = await deps.store.rows(input.userId);
  const row = rows.find((r) => r.deviceId === input.deviceId && r.revokedAt === null);
  if (!row) return false;
  await deps.store.markRevoked(row.keyHash, now);
  await disableAll(deps, [row.keyHash]);
  return true;
}

/** Ends every live key of a person (the admin block, or a sign-out everywhere). */
export async function revokeAllCredentials(deps: CredentialDeps, userId: string): Promise<number> {
  const now = (deps.now ?? (() => new Date()))();
  const live = (await deps.store.rows(userId)).filter((row) => row.revokedAt === null);
  for (const row of live) await deps.store.markRevoked(row.keyHash, now);
  await disableAll(
    deps,
    live.map((row) => row.keyHash),
  );
  return live.length;
}

/** Retries the provider side for keys that are revoked here but not yet confirmed disabled. */
export async function reapCredentials(deps: CredentialDeps, userId: string): Promise<number> {
  const pending = (await deps.store.rows(userId)).filter(
    (row) => row.revokedAt !== null && row.disabledAt === null,
  );
  await disableAll(
    deps,
    pending.map((row) => row.keyHash),
  );
  return pending.length;
}

async function disableAll(deps: CredentialDeps, hashes: string[]): Promise<void> {
  const at = (deps.now ?? (() => new Date()))();
  for (const hash of hashes) {
    try {
      await deps.keys.disable(hash);
      await deps.store.markDisabled(hash, at);
    } catch (error) {
      // The row stays revoked-but-not-disabled; the reaper tries again.
      deps.log?.('credential_disable_failed', {
        hash,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
