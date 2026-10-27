import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { authDb, db } from '../../db';
import {
  FOUNDING_SEATS,
  countFoundingSeats,
  get,
  recordUsage,
  recordUsageWithinLimit,
  save,
  usageCount,
} from './billing.repository';

describe('billing repository', () => {
  const userIds: string[] = [];

  afterEach(async () => {
    for (const userId of userIds.splice(0)) {
      await authDb.deleteFrom('user').where('id', '=', userId).execute();
    }
  });

  async function createUser() {
    const userId = randomUUID();
    userIds.push(userId);
    await authDb
      .insertInto('user')
      .values({ id: userId, name: 'Billing Test User', email: `${userId}@example.com` })
      .execute();
    return userId;
  }

  function input(userId: string, overrides: Record<string, unknown> = {}) {
    return {
      userId,
      tier: 'core' as const,
      status: 'active' as const,
      stripeCustomerId: `cus_${userId}`,
      stripeSubscriptionId: `sub_${userId}`,
      pricePence: 999,
      founding: false,
      currentPeriodEnd: new Date('2026-11-26T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
      ...overrides,
    };
  }

  it('stores one subscription per person, overwriting the previous one', async () => {
    const userId = await createUser();
    await save(input(userId, { tier: 'ai', pricePence: 1999 }));

    const updated = await save(input(userId, { founding: true, pricePence: 799 }));

    expect(updated.tier).toBe('core');
    expect(updated.founding).toBe(true);
    expect(await get(db, userId)).toMatchObject({
      tier: 'core',
      pricePence: 799,
      founding: true,
      currentPeriodEnd: '2026-11-26T00:00:00.000Z',
    });
  });

  async function seedFounders(prefix: string) {
    await db.deleteFrom('app.billingSubscriptions').execute();
    const ids = Array.from({ length: FOUNDING_SEATS }, () => randomUUID());
    userIds.push(...ids);
    await authDb
      .insertInto('user')
      .values(ids.map((id) => ({ id, name: 'Founding User', email: `${id}@example.com` })))
      .execute();
    await db
      .insertInto('app.billingSubscriptions')
      .values(
        ids.map((id, seat) => ({
          ...input(id, {
            founding: true,
            pricePence: 799,
            stripeSubscriptionId: `sub_${prefix}_${seat}`,
          }),
        })),
      )
      .execute();
    return ids;
  }

  it('grants the first 100 founding seats and refuses the 101st', async () => {
    await seedFounders('founder');
    expect(await countFoundingSeats(db)).toBe(FOUNDING_SEATS);

    const latecomer = await createUser();
    const saved = await save(input(latecomer, { founding: true, pricePence: 799 }));

    expect(saved.founding).toBe(false);
    expect(await countFoundingSeats(db)).toBe(FOUNDING_SEATS);
  });

  it('keeps a founding holder’s seat on later updates, even when the offer is full', async () => {
    const founders = await seedFounders('holder');

    const holder = founders[0]!;
    const updated = await save(
      input(holder, {
        founding: true,
        pricePence: 799,
        stripeSubscriptionId: 'sub_holder_0',
        cancelAtPeriodEnd: true,
      }),
    );
    expect(updated.founding).toBe(true);
    expect(updated.cancelAtPeriodEnd).toBe(true);

    // An AI-tier update arrives with no founding request and a higher price. The seat still belongs
    // to that subscription, so switching back to Core stays at the locked £7.99.
    const onAi = await save(
      input(holder, {
        tier: 'ai',
        founding: false,
        pricePence: 1999,
        stripeSubscriptionId: 'sub_holder_0',
      }),
    );
    expect(onAi.founding).toBe(true);
    expect(onAi.tier).toBe('ai');

    const backOnCore = await save(
      input(holder, {
        founding: true,
        pricePence: 799,
        stripeSubscriptionId: 'sub_holder_0',
      }),
    );
    expect(backOnCore.founding).toBe(true);
    expect(await countFoundingSeats(db)).toBe(FOUNDING_SEATS);
  });

  it('allows exactly the limit, then blocks the next interaction', async () => {
    const userId = await createUser();
    const since = new Date('2026-10-01T00:00:00.000Z');
    const at = (limit: number) => recordUsageWithinLimit({ userId, kind: 'chat', since, limit });

    expect(await at(2)).toBe(true);
    expect(await at(2)).toBe(true);
    expect(await at(2)).toBe(false);
    expect(await usageCount(db, { userId, kind: 'chat', since })).toBe(2);
  });

  it('does not let concurrent calls past the boundary both pass', async () => {
    const userId = await createUser();
    const since = new Date('2026-10-01T00:00:00.000Z');
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        recordUsageWithinLimit({ userId, kind: 'chat', since, limit: 2 }),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(2);
    expect(await usageCount(db, { userId, kind: 'chat', since })).toBe(2);
  });

  it('counts chat messages and skill calls separately', async () => {
    const userId = await createUser();
    const since = new Date('2026-10-01T00:00:00.000Z');
    await recordUsage(db, { userId, kind: 'chat' });
    await recordUsage(db, { userId, kind: 'skill' });
    await recordUsage(db, { userId, kind: 'skill' });

    expect(await usageCount(db, { userId, kind: 'chat', since })).toBe(1);
    expect(await usageCount(db, { userId, kind: 'skill', since })).toBe(2);
  });

  it('does not count last month’s usage against this month', async () => {
    const userId = await createUser();
    await db
      .insertInto('app.billingUsageEvents')
      .values({ userId, kind: 'chat', createdAt: new Date('2026-09-30T23:59:00.000Z') })
      .execute();

    expect(
      await usageCount(db, { userId, kind: 'chat', since: new Date('2026-10-01T00:00:00.000Z') }),
    ).toBe(0);
  });
});
