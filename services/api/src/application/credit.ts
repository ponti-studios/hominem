/**
 * Thames credit: a prepaid balance in pence (GBP) that replaces the monthly budget for the people
 * the flag lets in (docs/prd/top-up.md in the Thames repo).
 *
 * The rules:
 * - the balance is the ledger total minus what all the person's keys have spent, converted to
 *   pounds at one fixed rate (with a buffer, set in the environment);
 * - each live key's provider limit is what it has spent plus an equal share of the balance, so the
 *   keys' unspent limits never add up to more than the balance, and a top-up just raises them;
 * - a top-up credits exactly what the page promised: (price - card fee - 1 pound) / 1.055;
 * - the free grant is once per person, at most CREDIT_GRANTS_PER_DAY a day.
 *
 * Everything here talks to the outside through small ports, so the rules are tested without a
 * database, OpenRouter or Stripe.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import type { CredentialRow, CredentialStore, KeysClient } from './provider-credentials';

/** Thames's profit on each top-up, in pence. */
export const MARGIN_PENCE = 100;
/** Stripe's UK card fee: 1.5 percent plus 20p. */
export const STRIPE_FEE_RATE = 0.015;
export const STRIPE_FEE_FIXED_PENCE = 20;
/** OpenRouter's fee on the credit Thames buys from it. */
export const PROVIDER_FEE_RATE = 0.055;
/** The amounts the page offers, in whole pounds. */
export const TOP_UP_POUNDS: readonly number[] = [10, 20, 50];
/** Low is under this many pence, or under 15 percent of the last credit added if that is smaller. */
export const LOW_PENCE = 100;
export const LOW_FRACTION = 0.15;

export type CreditMode = 'off' | 'test' | 'live';

export interface CreditConfig {
  mode: CreditMode;
  /** Emails, or whole domains (with or without a leading @), that are in credit mode during `test`. */
  testers: string[];
  usdPerPound: number;
  grantPence: number;
  grantsPerDay: number;
}

/** The credit a payment of this many pence gives, rounded down to the penny. */
export function creditPenceFor(pricePence: number): number {
  const fee = Math.round(pricePence * STRIPE_FEE_RATE) + STRIPE_FEE_FIXED_PENCE;
  return Math.max(0, Math.floor((pricePence - fee - MARGIN_PENCE) / (1 + PROVIDER_FEE_RATE)));
}

export function parseTesters(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/** Whether this person is in credit mode. `off` is nobody, `test` only the testers, `live` everyone. */
export function inCreditMode(config: CreditConfig, email: string): boolean {
  if (config.mode === 'off') return false;
  if (config.mode === 'live') return true;
  const address = email.trim().toLowerCase();
  const domain = address.slice(address.lastIndexOf('@') + 1);
  return config.testers.some((entry) =>
    entry.includes('@') && !entry.startsWith('@')
      ? entry === address
      : entry.replace(/^@/, '') === domain,
  );
}

/** The level at which a balance counts as low. */
export function lowThresholdPence(lastAddedPence: number): number {
  return Math.min(LOW_PENCE, Math.floor(lastAddedPence * LOW_FRACTION));
}

export function isLow(balancePence: number, lastAddedPence: number): boolean {
  return balancePence < lowThresholdPence(lastAddedPence);
}

// ---- Signed top-up links ----------------------------------------------------------------------

export const LINK_TTL_SECONDS = 7 * 24 * 60 * 60;

function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

/** A link token that proves who may top up, without a sign-in: `<base64url json>.<signature>`. */
export function signLinkToken(secret: string, userId: string, now: Date): string {
  const body = Buffer.from(
    JSON.stringify({ u: userId, exp: Math.floor(now.getTime() / 1000) + LINK_TTL_SECONDS }),
  ).toString('base64url');
  return `${body}.${sign(secret, body)}`;
}

/** The user id in a valid, unexpired token, or null. */
export function verifyLinkToken(secret: string, token: string, now: Date): string | null {
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(secret, body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'u' in parsed &&
      'exp' in parsed &&
      typeof parsed.u === 'string' &&
      typeof parsed.exp === 'number' &&
      parsed.exp > Math.floor(now.getTime() / 1000)
    ) {
      return parsed.u;
    }
  } catch {
    return null;
  }
  return null;
}

// ---- Ports ------------------------------------------------------------------------------------

export type PaymentStatus = 'credited' | 'refunded_not_uk';

export interface CreditStore {
  /** The sum of every ledger row, in pence. */
  ledgerPence(userId: string): Promise<number>;
  /** The latest grant or top-up, in pence (0 when there is none). */
  lastAddedPence(userId: string): Promise<number>;
  hasLedger(userId: string): Promise<boolean>;
  /**
   * Gives the person their free credit unless they already have it ('has') or `max` grants have
   * been given since `since` ('full'). The count and the insert are one atomic step, so
   * simultaneous first uses cannot exceed `max`.
   */
  grantIfRoom(input: {
    userId: string;
    pence: number;
    since: Date;
    max: number;
  }): Promise<'added' | 'has' | 'full'>;
  /**
   * In one transaction: record the payment, and for a credited one add the top-up to the ledger.
   * 'duplicate' when this Checkout session was already handled.
   */
  recordPayment(input: {
    sessionId: string;
    userId: string;
    amountPence: number;
    creditPence: number;
    status: PaymentStatus;
  }): Promise<'new' | 'duplicate'>;
  /** One Checkout session's recorded payment for this person, or null before the webhook has run. */
  paymentFor(
    userId: string,
    sessionId: string,
  ): Promise<{ status: PaymentStatus; creditPence: number } | null>;
  lowNotifiedAt(userId: string): Promise<Date | null>;
  setLowNotified(userId: string, at: Date | null): Promise<void>;
}

/** The provider side the credit rules need beyond the credential rules. */
export interface CreditKeys extends KeysClient {
  /** What the key has spent over its whole life, in USD. */
  usage(hash: string): Promise<number>;
  /** Sets the key's total spend ceiling, in USD. */
  setLimit(hash: string, limitUsd: number): Promise<void>;
}

export interface CreditDeps {
  store: CreditStore;
  credentials: CredentialStore & { setLimit(keyHash: string, limitUsd: number): Promise<void> };
  keys: CreditKeys;
  config: CreditConfig;
  now?: () => Date;
  log?: (event: string, fields: Record<string, unknown>) => void;
}

function clock(deps: { now?: () => Date }): Date {
  return (deps.now ?? (() => new Date()))();
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
function floor4(value: number): number {
  return Math.floor(value * 10_000) / 10_000;
}

/** Gives a person their free credit, once, unless today's grant limit is used up. */
export async function ensureGrant(deps: CreditDeps, userId: string): Promise<void> {
  if (deps.config.grantPence <= 0) return;
  if (await deps.store.hasLedger(userId)) return;
  const now = clock(deps);
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const result = await deps.store.grantIfRoom({
    userId,
    pence: deps.config.grantPence,
    since: dayStart,
    max: deps.config.grantsPerDay,
  });
  if (result === 'full') deps.log?.('credit_grant_limit_reached', { userId });
}

/** How many provider reads run at once; a person with many rotated keys must not burst the provider. */
const USAGE_READS_AT_ONCE = 5;

/** Reads each key's lifetime spend, a few at a time. */
async function usageOfKeys(deps: CreditDeps, rows: CredentialRow[]): Promise<Map<string, number>> {
  const usage = new Map<string, number>();
  let next = 0;
  const worker = async () => {
    while (next < rows.length) {
      const row = rows[next++]!;
      usage.set(row.keyHash, await deps.keys.usage(row.keyHash));
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(USAGE_READS_AT_ONCE, rows.length) }, () => worker()),
  );
  return usage;
}

export interface CreditSnapshot {
  balancePence: number;
  lastAddedPence: number;
  rows: CredentialRow[];
  usage: Map<string, number>;
}

/**
 * The balance now: the ledger total minus every key's lifetime spend (revoked keys included),
 * converted to pence at the fixed rate and rounded up so the balance never overstates.
 */
export async function creditSnapshot(deps: CreditDeps, userId: string): Promise<CreditSnapshot> {
  const rows = await deps.credentials.rows(userId);
  const usage = await usageOfKeys(deps, rows);
  const spentUsd = [...usage.values()].reduce((sum, value) => sum + value, 0);
  const spentPence = Math.ceil((spentUsd / deps.config.usdPerPound) * 100);
  const ledger = await deps.store.ledgerPence(userId);
  return {
    balancePence: Math.max(0, ledger - spentPence),
    lastAddedPence: await deps.store.lastAddedPence(userId),
    rows,
    usage,
  };
}

/** What the balance is worth at the provider, in USD. */
export function balanceUsd(balancePence: number, usdPerPound: number): number {
  return floor4((balancePence / 100) * usdPerPound);
}

/**
 * Sets each live key's limit to what it has spent plus an equal share of the balance. Called after
 * a top-up, after a mint, and when a read finds a limit out of line (a failed earlier attempt).
 * Returns how many keys it changed.
 */
export async function reconcileLimits(
  deps: CreditDeps,
  snapshot: CreditSnapshot,
  options: { strict?: boolean } = {},
): Promise<number> {
  const live = snapshot.rows.filter((row) => row.revokedAt === null);
  if (live.length === 0) return 0;
  const share = floor4(balanceUsd(snapshot.balancePence, deps.config.usdPerPound) / live.length);
  let changed = 0;
  for (const row of live) {
    const spent = snapshot.usage.get(row.keyHash) ?? 0;
    // Never zero: a zero limit might read as "no limit" at the provider.
    const desired = Math.max(round4(spent + share), round4(spent + 0.0001));
    if (Math.abs(desired - row.limitUsd) < 0.01) continue;
    try {
      await deps.keys.setLimit(row.keyHash, desired);
      await deps.credentials.setLimit(row.keyHash, desired);
      changed += 1;
    } catch (error) {
      deps.log?.('credit_limit_update_failed', {
        hash: row.keyHash,
        error: error instanceof Error ? error.message : String(error),
      });
      // Minting needs every limit lowered before the new key is released; elsewhere the next read repairs it.
      if (options.strict) throw error;
    }
  }
  return changed;
}

/** The limit a new key starts with: an equal share of the balance among the keys that will be live. */
export function newKeyLimitUsd(
  balancePence: number,
  usdPerPound: number,
  liveAfterMint: number,
): number {
  return floor4(balanceUsd(balancePence, usdPerPound) / Math.max(1, liveAfterMint));
}

// ---- What the app is told ----------------------------------------------------------------------

export interface CreditReading {
  balancePence: number;
  lastAddedPence: number;
  usdPerPound: number;
  asOf: string;
}

export interface LowEmail {
  send(input: { userId: string }): Promise<void>;
}

/**
 * The credit reply for the app's budget read: grants the free credit if due, reads the balance,
 * repairs any limit out of line, and sends the "running low" email once per low spell.
 */
export async function creditFor(
  deps: CreditDeps,
  userId: string,
  low?: LowEmail,
): Promise<CreditReading> {
  await ensureGrant(deps, userId);
  const snapshot = await creditSnapshot(deps, userId);
  await reconcileLimits(deps, snapshot);
  const lastAdded = snapshot.lastAddedPence;
  if (
    low &&
    isLow(snapshot.balancePence, lastAdded) &&
    (await deps.store.lowNotifiedAt(userId)) === null
  ) {
    try {
      await low.send({ userId });
      await deps.store.setLowNotified(userId, clock(deps));
    } catch (error) {
      deps.log?.('credit_low_email_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    balancePence: snapshot.balancePence,
    lastAddedPence: lastAdded,
    usdPerPound: deps.config.usdPerPound,
    asOf: clock(deps).toISOString(),
  };
}
