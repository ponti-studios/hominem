import { sql, type Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import { runInTransaction } from '../../transaction';
import type { AppBillingSubscriptions } from '../../types/database';

type BillingSubscriptionRow = Selectable<AppBillingSubscriptions>;

/** The founding offer is for the first 100 Core subscriptions (docs/billing.md). */
export const FOUNDING_SEATS = 100;

export type BillingTier = 'core' | 'ai';
export type BillingStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';
export type BillingUsageKind = 'chat' | 'skill';

export interface BillingSubscriptionRecord {
  userId: string;
  tier: BillingTier;
  status: BillingStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  pricePence: number;
  founding: boolean;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveBillingSubscriptionInput {
  userId: string;
  tier: BillingTier;
  status: BillingStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  pricePence: number;
  /** True when the subscription was created with the founding price; the seat is only kept if one is free. */
  founding: boolean;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

const TIERS: readonly BillingTier[] = ['core', 'ai'];
const STATUSES: readonly BillingStatus[] = [
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'paused',
];
const USAGE_KINDS: readonly BillingUsageKind[] = ['chat', 'skill'];

function parseTier(value: string): BillingTier {
  const tier = TIERS.find((candidate) => candidate === value);
  if (!tier) throw new Error(`Invalid billing tier: ${value}`);
  return tier;
}

function parseStatus(value: string): BillingStatus {
  const status = STATUSES.find((candidate) => candidate === value);
  if (!status) throw new Error(`Invalid billing status: ${value}`);
  return status;
}

function parseUsageKind(value: string): BillingUsageKind {
  const kind = USAGE_KINDS.find((candidate) => candidate === value);
  if (!kind) throw new Error(`Invalid billing usage kind: ${value}`);
  return kind;
}

function toRecord(row: BillingSubscriptionRow): BillingSubscriptionRecord {
  return {
    userId: row.userId,
    tier: parseTier(row.tier),
    status: parseStatus(row.status),
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    pricePence: row.pricePence,
    founding: row.founding,
    currentPeriodEnd: new Date(row.currentPeriodEnd).toISOString(),
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/** One row per person, overwritten by the newest subscription so a stale webhook cannot grant access. */
export async function save(
  input: SaveBillingSubscriptionInput,
): Promise<BillingSubscriptionRecord> {
  return runInTransaction(async (trx) => {
    if (input.founding) {
      // The seat count and the write must be one step: two simultaneous first-100 signups otherwise
      // both see seat 100 free and the 101st pays the founding price forever.
      await sql`SELECT pg_advisory_xact_lock(hashtext('app.billing_subscriptions.founding'))`.execute(
        trx,
      );
    }

    const existing = await trx
      .selectFrom('app.billingSubscriptions')
      .select(['founding', 'stripeSubscriptionId'])
      .where('userId', '=', input.userId)
      .executeTakeFirst();
    // A founding subscriber keeps their locked price on every later update, even once all 100 are taken.
    const keepsSeat =
      existing?.founding === true && existing.stripeSubscriptionId === input.stripeSubscriptionId;
    const founding = input.founding
      ? keepsSeat || (await countFoundingSeats(trx)) < FOUNDING_SEATS
      : false;

    const row = await trx
      .insertInto('app.billingSubscriptions')
      .values({
        userId: input.userId,
        tier: input.tier,
        status: input.status,
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        pricePence: input.pricePence,
        founding,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      })
      .onConflict((oc) =>
        oc.column('userId').doUpdateSet({
          tier: input.tier,
          status: input.status,
          stripeCustomerId: input.stripeCustomerId,
          stripeSubscriptionId: input.stripeSubscriptionId,
          pricePence: input.pricePence,
          founding,
          currentPeriodEnd: input.currentPeriodEnd,
          cancelAtPeriodEnd: input.cancelAtPeriodEnd,
          updatedAt: new Date(),
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return toRecord(row);
  });
}

export async function get(db: DbHandle, userId: string): Promise<BillingSubscriptionRecord | null> {
  const row = await db
    .selectFrom('app.billingSubscriptions')
    .selectAll()
    .where('userId', '=', userId)
    .executeTakeFirst();
  return row ? toRecord(row) : null;
}

export async function countFoundingSeats(db: DbHandle): Promise<number> {
  const result = await db
    .selectFrom('app.billingSubscriptions')
    .select(({ fn }) => fn.countAll<number>().as('count'))
    .where('founding', '=', true)
    .executeTakeFirst();
  return Number(result?.count ?? 0);
}

/**
 * Records one billable interaction and answers whether it was inside `limit`. The count and the
 * insert are one statement, so two calls at the boundary cannot both pass.
 */
export async function recordUsageWithinLimit(
  db: DbHandle,
  input: { userId: string; kind: BillingUsageKind; since: Date; limit: number },
): Promise<boolean> {
  const result = await sql<{ id: string }>`
    INSERT INTO app.billing_usage_events (user_id, kind)
    SELECT ${input.userId}, ${input.kind}
    WHERE (
      SELECT count(*) FROM app.billing_usage_events
      WHERE user_id = ${input.userId}
        AND kind = ${input.kind}
        AND created_at >= ${input.since}
    ) < ${input.limit}
    RETURNING id
  `.execute(db);
  return result.rows.length > 0;
}

/** Records one billable interaction on a tier with no limit for this kind. */
export async function recordUsage(
  db: DbHandle,
  input: { userId: string; kind: BillingUsageKind },
): Promise<void> {
  await db
    .insertInto('app.billingUsageEvents')
    .values({ userId: input.userId, kind: input.kind })
    .execute();
}

export async function usageCount(
  db: DbHandle,
  input: { userId: string; kind: BillingUsageKind; since: Date },
): Promise<number> {
  const result = await db
    .selectFrom('app.billingUsageEvents')
    .select(({ fn }) => fn.countAll<number>().as('count'))
    .where('userId', '=', input.userId)
    .where('kind', '=', input.kind)
    .where('createdAt', '>=', input.since.toISOString())
    .executeTakeFirst();
  return Number(result?.count ?? 0);
}

export const BillingRepository = {
  save,
  get,
  countFoundingSeats,
  recordUsageWithinLimit,
  recordUsage,
  usageCount,
};

// Keeps the kind parser (and its check against the DB constraint) next to the queries that use it.
export { parseUsageKind, parseStatus, parseTier };
