import { describe, expect, it, vi } from 'vitest';

import {
  type CredentialDeps,
  type CredentialRow,
  type CredentialStore,
  type KeysClient,
  BUDGET_DEADLINE_MS,
  BudgetUnavailableError,
  budgetFor,
  DEVICE_LIMIT,
  USAGE_CONCURRENCY,
  MINTS_PER_HOUR,
  mintCredential,
  reapCredentials,
  revokeAllCredentials,
  revokeCredential,
} from './provider-credentials';

const USER = 'user-1';
const EMAIL = 'Dana@Work.com';
const CAP = 5;
const START = new Date('2026-10-16T12:00:00Z');

function fakes(overrides: { allowed?: boolean; blocked?: boolean } = {}) {
  const rows: CredentialRow[] = [];
  const usage = new Map<string, number>();
  const disabled = new Set<string>();
  const failDisable = new Set<string>();
  let counter = 0;
  let clock = START;
  const created: { name: string; limitUsd: number; hash: string }[] = [];

  const store: CredentialStore = {
    isBlocked: async () => overrides.blocked ?? false,
    isAllowed: async (email) => (overrides.allowed ?? true) && email === 'dana@work.com',
    rows: async (userId) => rows.filter((row) => row.userId === userId),
    replace: async ({ revokeHashes, insert, at }) => {
      for (const row of rows) if (revokeHashes.includes(row.keyHash)) row.revokedAt = at;
      rows.push({ id: `id-${rows.length}`, revokedAt: null, disabledAt: null, ...insert });
    },
    markRevoked: async (hash, at) => {
      const row = rows.find((r) => r.keyHash === hash);
      if (row) row.revokedAt = at;
    },
    markDisabled: async (hash, at) => {
      const row = rows.find((r) => r.keyHash === hash);
      if (row) row.disabledAt = at;
    },
  };
  const keys: KeysClient = {
    create: async ({ name, limitUsd }) => {
      counter += 1;
      const hash = `hash-${counter}`;
      created.push({ name, limitUsd, hash });
      return { key: `sk-or-${counter}`, hash };
    },
    disable: async (hash) => {
      if (failDisable.has(hash)) throw new Error('provider down');
      disabled.add(hash);
    },
    usageMonthly: async (hash) => usage.get(hash) ?? 0,
  };
  const deps: CredentialDeps = { store, keys, capUsd: CAP, now: () => clock };
  return {
    deps,
    rows,
    usage,
    disabled,
    failDisable,
    created,
    advance: (ms: number) => {
      clock = new Date(clock.getTime() + ms);
    },
    setClock: (date: Date) => {
      clock = date;
    },
  };
}

const mint = (f: ReturnType<typeof fakes>, deviceId: string) =>
  mintCredential(f.deps, { userId: USER, email: EMAIL, deviceId });

describe('mintCredential', () => {
  it('mints a key named for the person and device, limited to a third of the cap', async () => {
    const f = fakes();
    const outcome = await mint(f, 'device-aaaa');
    expect(outcome).toMatchObject({ kind: 'minted', key: 'sk-or-1', limitUsd: 1.6666 });
    expect(f.created[0]?.name).toBe('thames:user-1:device-aaaa');
    expect(f.rows).toHaveLength(1);
    expect(JSON.stringify(f.rows)).not.toContain('sk-or-');
  });

  it('refuses an email that is not on the allow-list', async () => {
    const f = fakes({ allowed: false });
    expect(await mint(f, 'device-aaaa')).toEqual({ kind: 'not_listed' });
    expect(f.created).toHaveLength(0);
  });

  it('refuses a blocked person even with an allowed email', async () => {
    const f = fakes({ blocked: true });
    expect(await mint(f, 'device-aaaa')).toEqual({ kind: 'blocked' });
    expect(f.created).toHaveLength(0);
  });

  it('keeps one live key per device: minting again ends the old one', async () => {
    const f = fakes();
    await mint(f, 'device-aaaa');
    await mint(f, 'device-aaaa');
    const live = f.rows.filter((row) => row.revokedAt === null);
    expect(live).toHaveLength(1);
    expect(live[0]?.keyHash).toBe('hash-2');
    expect(f.disabled.has('hash-1')).toBe(true);
    expect(f.rows[0]?.disabledAt).not.toBeNull();
  });

  it('ends the oldest device key when a fourth device signs in', async () => {
    const f = fakes();
    for (const id of ['device-aaaa', 'device-bbbb', 'device-cccc']) {
      await mint(f, id);
      f.advance(1000);
    }
    await mint(f, 'device-dddd');
    const live = f.rows.filter((row) => row.revokedAt === null);
    expect(live).toHaveLength(DEVICE_LIMIT);
    expect(live.map((row) => row.deviceId)).not.toContain('device-aaaa');
    expect(f.disabled.has('hash-1')).toBe(true);
  });

  it('cannot refill a spent budget by replacing the key or reinstalling', async () => {
    const f = fakes();
    await mint(f, 'device-aaaa');
    f.usage.set('hash-1', 1.6666); // the first key is spent
    const second = await mint(f, 'device-aaaa');
    // Spent 1.6666; nothing else is promised, so the rest of the budget is available...
    expect(second).toMatchObject({ kind: 'minted' });
    // ...but never more than the cap in total: spend it all and the next mint is refused.
    f.usage.set('hash-2', 1.6666);
    const third = await mint(f, 'device-aaaa');
    expect(third).toMatchObject({ kind: 'minted' });
    f.usage.set('hash-3', 1.6666);
    expect(await mint(f, 'device-aaaa')).toEqual({ kind: 'capped' });
  });

  it('counts promised allowance on other devices so the live limits never exceed the cap', async () => {
    const f = fakes();
    await mint(f, 'device-aaaa');
    await mint(f, 'device-bbbb');
    f.advance(1000);
    await mint(f, 'device-cccc');
    const live = f.rows.filter((row) => row.revokedAt === null);
    const total = live.reduce((sum, row) => sum + row.limitUsd, 0);
    expect(total).toBeLessThanOrEqual(CAP);
  });

  it('returns capped when the person has spent the whole month', async () => {
    const f = fakes();
    await mint(f, 'device-aaaa');
    f.usage.set('hash-1', CAP);
    expect(await mint(f, 'device-bbbb')).toEqual({ kind: 'capped' });
    // A refused mint changes nothing: the existing key is still live.
    expect(f.rows.filter((row) => row.revokedAt === null)).toHaveLength(1);
  });

  it('starts a fresh budget in a new month', async () => {
    const f = fakes();
    await mint(f, 'device-aaaa');
    f.usage.set('hash-1', CAP);
    f.setClock(new Date('2026-11-01T00:00:01Z'));
    // The provider's monthly usage starts again at zero on the first.
    f.usage.set('hash-1', 0);
    expect(await mint(f, 'device-aaaa')).toMatchObject({ kind: 'minted' });
  });

  it('counts what an older live key spends after the month turns over', async () => {
    const f = fakes();
    await mint(f, 'device-aaaa');
    f.setClock(new Date('2026-11-01T00:00:01Z'));
    f.usage.set('hash-1', CAP);
    expect(await mint(f, 'device-bbbb')).toEqual({ kind: 'capped' });
  });

  it('rate limits minting', async () => {
    const f = fakes();
    for (let i = 0; i < MINTS_PER_HOUR; i += 1) await mint(f, 'device-aaaa');
    expect(await mint(f, 'device-aaaa')).toEqual({ kind: 'rate_limited' });
    f.advance(61 * 60 * 1000);
    expect(await mint(f, 'device-aaaa')).toMatchObject({ kind: 'minted' });
  });

  it('disables the new key when the row cannot be saved', async () => {
    const f = fakes();
    f.deps.store.replace = async () => {
      throw new Error('db down');
    };
    await expect(mint(f, 'device-aaaa')).rejects.toThrow('db down');
    expect(f.disabled.has('hash-1')).toBe(true);
  });

  it('keeps a revoked row for the reaper when the provider is down', async () => {
    const f = fakes();
    await mint(f, 'device-aaaa');
    f.failDisable.add('hash-1');
    await mint(f, 'device-aaaa');
    expect(f.rows[0]?.revokedAt).not.toBeNull();
    expect(f.rows[0]?.disabledAt).toBeNull();
    f.failDisable.clear();
    expect(await reapCredentials(f.deps, USER)).toBe(1);
    expect(f.rows[0]?.disabledAt).not.toBeNull();
  });
});

describe('revokeCredential', () => {
  it("ends one device's key and leaves the others working", async () => {
    const f = fakes();
    await mint(f, 'device-aaaa');
    await mint(f, 'device-bbbb');
    expect(await revokeCredential(f.deps, { userId: USER, deviceId: 'device-aaaa' })).toBe(true);
    const live = f.rows.filter((row) => row.revokedAt === null);
    expect(live.map((row) => row.deviceId)).toEqual(['device-bbbb']);
    expect(f.disabled.has('hash-1')).toBe(true);
    expect(f.disabled.has('hash-2')).toBe(false);
  });

  it('returns false for a device the person does not have', async () => {
    const f = fakes();
    await mint(f, 'device-aaaa');
    expect(await revokeCredential(f.deps, { userId: USER, deviceId: 'device-zzzz' })).toBe(false);
    expect(
      await revokeCredential(f.deps, { userId: 'someone-else', deviceId: 'device-aaaa' }),
    ).toBe(false);
  });
});

describe('revokeAllCredentials', () => {
  it('ends every live key, and a block then stops new ones', async () => {
    const f = fakes();
    await mint(f, 'device-aaaa');
    await mint(f, 'device-bbbb');
    expect(await revokeAllCredentials(f.deps, USER)).toBe(2);
    expect(f.rows.every((row) => row.revokedAt !== null)).toBe(true);
    const blocked = fakes({ blocked: true });
    expect(await mint(blocked, 'device-aaaa')).toEqual({ kind: 'blocked' });
  });
});

describe('budgetFor', () => {
  it('is the whole budget for a person with no keys, and says when it resets', async () => {
    const { deps } = fakes();
    expect(await budgetFor(deps, USER)).toEqual({
      capUsd: CAP,
      spentUsd: 0,
      remainingUsd: CAP,
      resetsAt: '2026-11-01T00:00:00.000Z',
      asOf: START.toISOString(),
    });
  });

  it('adds up every key of this month, revoked ones included', async () => {
    const { deps, usage } = fakes();
    await mintCredential(deps, { userId: USER, email: EMAIL, deviceId: 'phone-0001' });
    await mintCredential(deps, { userId: USER, email: EMAIL, deviceId: 'phone-0001' });
    usage.set('hash-1', 1.25);
    usage.set('hash-2', 0.5);
    const budget = await budgetFor(deps, USER);
    expect(budget.spentUsd).toBe(1.75);
    expect(budget.remainingUsd).toBe(3.25);
  });

  it('never goes below zero when the soft limits were overshot', async () => {
    const { deps, usage } = fakes();
    await mintCredential(deps, { userId: USER, email: EMAIL, deviceId: 'phone-0001' });
    usage.set('hash-1', 6.1);
    const budget = await budgetFor(deps, USER);
    expect(budget.spentUsd).toBe(6.1);
    expect(budget.remainingUsd).toBe(0);
  });

  it('starts the month from what the provider reports now, and says when it resets', async () => {
    const { deps, usage, advance } = fakes();
    await mintCredential(deps, { userId: USER, email: EMAIL, deviceId: 'phone-0001' });
    usage.set('hash-1', 2);
    advance(20 * 24 * 60 * 60 * 1000);
    // The provider's monthly usage starts again at zero; the key is still live, so it still counts.
    usage.set('hash-1', 0.7);
    const budget = await budgetFor(deps, USER);
    expect(budget.spentUsd).toBe(0.7);
    expect(budget.remainingUsd).toBe(4.3);
    expect(budget.resetsAt).toBe('2026-12-01T00:00:00.000Z');
  });

  const oldRow = (over: Partial<CredentialRow>): CredentialRow => ({
    id: 'old',
    userId: USER,
    deviceId: 'phone-0002',
    keyHash: 'old-hash',
    period: '2026-09',
    limitUsd: 1.6,
    createdAt: new Date('2026-09-20T12:00:00Z'),
    revokedAt: null,
    disabledAt: null,
    ...over,
  });

  it('counts a key made last month that is still live', async () => {
    const { deps, rows, usage } = fakes();
    rows.push(oldRow({}));
    usage.set('old-hash', 1.5);
    expect((await budgetFor(deps, USER)).spentUsd).toBe(1.5);
  });

  it('counts a key revoked this month, but does not even ask about one revoked before it', async () => {
    const { deps, rows, usage } = fakes();
    rows.push(oldRow({ keyHash: 'revoked-now', revokedAt: new Date('2026-10-05T00:00:00Z') }));
    rows.push(oldRow({ keyHash: 'revoked-then', revokedAt: new Date('2026-09-25T00:00:00Z') }));
    usage.set('revoked-now', 0.4);
    usage.set('revoked-then', 9);
    const asked: string[] = [];
    const original = deps.keys.usageMonthly;
    deps.keys.usageMonthly = async (hash) => {
      asked.push(hash);
      return original(hash);
    };
    expect((await budgetFor(deps, USER)).spentUsd).toBe(0.4);
    expect(asked).toEqual(['revoked-now']);
  });

  it('reads usage a few keys at a time, not one by one and not all at once', async () => {
    const { deps, rows } = fakes();
    for (let i = 0; i < 12; i++) {
      rows.push(oldRow({ keyHash: `k${i}`, period: '2026-10', deviceId: `d${i}` }));
    }
    let inFlight = 0;
    let most = 0;
    deps.keys.usageMonthly = async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return 0.1;
    };
    expect((await budgetFor(deps, USER)).spentUsd).toBe(1.2);
    expect(most).toBeGreaterThan(1);
    expect(most).toBeLessThanOrEqual(USAGE_CONCURRENCY);
  });

  it('gives up after a deadline instead of returning a partial total', async () => {
    vi.useFakeTimers();
    try {
      const { deps, rows } = fakes();
      rows.push(oldRow({ keyHash: 'slow', period: '2026-10' }));
      deps.keys.usageMonthly = () => new Promise<number>(() => undefined);
      const outcome = expect(budgetFor(deps, USER)).rejects.toBeInstanceOf(BudgetUnavailableError);
      await vi.advanceTimersByTimeAsync(BUDGET_DEADLINE_MS + 1);
      await outcome;
    } finally {
      vi.useRealTimers();
    }
  });
});
