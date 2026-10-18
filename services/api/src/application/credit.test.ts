import { describe, expect, it } from 'vitest';

import {
  creditFor,
  creditPenceFor,
  creditSnapshot,
  inCreditMode,
  isLow,
  lowThresholdPence,
  newKeyLimitUsd,
  parseTesters,
  reconcileLimits,
  signLinkToken,
  verifyLinkToken,
  type CreditConfig,
  type CreditDeps,
  type CreditStore,
} from './credit';
import { mintCredential, type CredentialRow, type CredentialStore } from './provider-credentials';

const config: CreditConfig = {
  mode: 'test',
  testers: parseTesters('dana@work.com, @team.dev ,ops.io'),
  usdPerPound: 1.25,
  grantPence: 100,
  grantsPerDay: 2,
};
const now = new Date('2026-10-18T10:00:00Z');

describe('the price of credit', () => {
  it('gives what the page promises, rounded down to the penny', () => {
    expect(creditPenceFor(1000)).toBe(819);
    expect(creditPenceFor(2000)).toBe(1753);
    expect(creditPenceFor(5000)).toBe(4554);
  });
  it('never goes below zero for a tiny payment', () => {
    expect(creditPenceFor(50)).toBe(0);
  });
});

describe('the flag', () => {
  it('is off for everyone when off, and for everyone when live', () => {
    expect(inCreditMode({ ...config, mode: 'off' }, 'dana@work.com')).toBe(false);
    expect(inCreditMode({ ...config, mode: 'live' }, 'anyone@anywhere.com')).toBe(true);
  });
  it('in test lets in listed emails and whole domains only, ignoring case', () => {
    expect(inCreditMode(config, 'Dana@Work.com')).toBe(true);
    expect(inCreditMode(config, 'sam@team.dev')).toBe(true);
    expect(inCreditMode(config, 'kim@ops.io')).toBe(true);
    expect(inCreditMode(config, 'eve@work.com')).toBe(false);
    expect(inCreditMode(config, 'dana@work.com.evil.io')).toBe(false);
  });
});

describe('low credit', () => {
  it('is under 1 pound, or under 15 percent of the last credit if that is smaller', () => {
    expect(lowThresholdPence(100)).toBe(15);
    expect(lowThresholdPence(819)).toBe(100);
    expect(lowThresholdPence(0)).toBe(0);
    expect(isLow(14, 100)).toBe(true);
    expect(isLow(15, 100)).toBe(false);
    expect(isLow(99, 819)).toBe(true);
    expect(isLow(100, 819)).toBe(false);
  });
});

describe('signed links', () => {
  it('verify, expire, and reject tampering', () => {
    const token = signLinkToken('s3cret-s3cret-s3cret', 'user-1', now);
    expect(verifyLinkToken('s3cret-s3cret-s3cret', token, now)).toBe('user-1');
    expect(verifyLinkToken('other-secret-other-secret', token, now)).toBeNull();
    const week = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    expect(verifyLinkToken('s3cret-s3cret-s3cret', token, week)).toBeNull();
    const [body, signature] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ u: 'user-2', exp: 9_999_999_999 })).toString('base64url')}.${signature}`;
    expect(verifyLinkToken('s3cret-s3cret-s3cret', forged, now)).toBeNull();
    expect(verifyLinkToken('s3cret-s3cret-s3cret', `${body}`, now)).toBeNull();
    expect(verifyLinkToken('s3cret-s3cret-s3cret', 'a.b.c', now)).toBeNull();
  });
});

// ---- Fakes -----------------------------------------------------------------------------------

function fakeWorld(
  options: { ledger?: number; usage?: Record<string, number>; grantsToday?: number } = {},
) {
  const state: {
    ledger: number;
    hasLedger: boolean;
    lastAdded: number;
    grantsToday: number;
    lowNotified: Date | null;
    rows: CredentialRow[];
    usage: Record<string, number>;
    limits: Record<string, number>;
    emails: number;
    created: { name: string; limitUsd: number }[];
  } = {
    ledger: options.ledger ?? 0,
    hasLedger: (options.ledger ?? 0) > 0,
    lastAdded: options.ledger ?? 0,
    grantsToday: options.grantsToday ?? 0,
    lowNotified: null,
    rows: [],
    usage: { ...options.usage },
    limits: {},
    emails: 0,
    created: [],
  };
  const store: CreditStore = {
    ledgerPence: async () => state.ledger,
    lastAddedPence: async () => state.lastAdded,
    hasLedger: async () => state.hasLedger,
    grantsSince: async () => state.grantsToday,
    addGrant: async (_user, pence) => {
      if (state.hasLedger) return false;
      state.hasLedger = true;
      state.ledger += pence;
      state.lastAdded = pence;
      state.grantsToday += 1;
      return true;
    },
    recordPayment: async () => 'new',
    lowNotifiedAt: async () => state.lowNotified,
    setLowNotified: async (_user, at) => {
      state.lowNotified = at;
    },
  };
  const credentials: CredentialStore & { setLimit(h: string, l: number): Promise<void> } = {
    isBlocked: async () => false,
    isAllowed: async () => true,
    rows: async () => state.rows,
    replace: async ({ revokeHashes, insert, at }) => {
      for (const row of state.rows) if (revokeHashes.includes(row.keyHash)) row.revokedAt = at;
      state.rows.push({
        id: insert.keyHash,
        ...insert,
        revokedAt: null,
        disabledAt: null,
      });
    },
    markRevoked: async () => undefined,
    markDisabled: async () => undefined,
    setLimit: async (hash, limit) => {
      const row = state.rows.find((r) => r.keyHash === hash);
      if (row) row.limitUsd = limit;
    },
  };
  const keys = {
    create: async ({ name, limitUsd }: { name: string; limitUsd: number }) => {
      state.created.push({ name, limitUsd });
      const hash = `hash-${state.created.length}`;
      state.limits[hash] = limitUsd;
      return { key: `sk-${hash}`, hash };
    },
    disable: async () => undefined,
    usageMonthly: async (hash: string) => state.usage[hash] ?? 0,
    usage: async (hash: string) => state.usage[hash] ?? 0,
    setLimit: async (hash: string, limit: number) => {
      state.limits[hash] = limit;
    },
  };
  const deps: CreditDeps = { store, credentials, keys, config, now: () => now };
  return { state, deps };
}

function row(hash: string, limitUsd: number, deviceId = `device-${hash}`): CredentialRow {
  return {
    id: hash,
    userId: 'u1',
    deviceId,
    keyHash: hash,
    period: '2026-10',
    limitUsd,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    revokedAt: null,
    disabledAt: null,
  };
}

describe('the balance', () => {
  it("is the ledger minus every key's lifetime spend at the fixed rate, rounded up", async () => {
    const { state, deps } = fakeWorld({ ledger: 1000, usage: { a: 0.5, b: 0.3 } });
    state.rows = [row('a', 1), row('b', 1)];
    const snapshot = await creditSnapshot(deps, 'u1');
    // $0.80 at 1.25 dollars a pound is 64p.
    expect(snapshot.balancePence).toBe(1000 - 64);
  });
  it('never shows less than nothing', async () => {
    const { state, deps } = fakeWorld({ ledger: 10, usage: { a: 5 } });
    state.rows = [row('a', 1)];
    expect((await creditSnapshot(deps, 'u1')).balancePence).toBe(0);
  });
});

describe('key limits', () => {
  it('give each live key what it has spent plus an equal share of the balance', async () => {
    const { state, deps } = fakeWorld({ ledger: 1000, usage: { a: 1 } });
    state.rows = [row('a', 2), row('b', 2)];
    const changed = await reconcileLimits(deps, await creditSnapshot(deps, 'u1'));
    // Balance: 1000p - 80p = 920p = $11.50, so each key gets $5.75 more than it has spent.
    expect(changed).toBe(2);
    expect(state.limits.a).toBeCloseTo(1 + 5.75, 3);
    expect(state.limits.b).toBeCloseTo(5.75, 3);
  });
  it('rise after a top-up without a new key', async () => {
    const { state, deps } = fakeWorld({ ledger: 100 });
    state.rows = [row('a', 1.25)];
    state.ledger += 819;
    await reconcileLimits(deps, await creditSnapshot(deps, 'u1'));
    expect(state.limits.a).toBeCloseTo((919 / 100) * 1.25, 3);
  });
  it('fall to just above what was spent when nothing is left, never to zero', async () => {
    const { state, deps } = fakeWorld({ ledger: 100, usage: { a: 1.25 } });
    state.rows = [row('a', 3)];
    await reconcileLimits(deps, await creditSnapshot(deps, 'u1'));
    expect(state.limits.a).toBeGreaterThan(1.25);
    expect(state.limits.a).toBeLessThan(1.26);
  });
  it('a new key gets an equal share among the keys that will be live', () => {
    expect(newKeyLimitUsd(1000, 1.25, 2)).toBeCloseTo(6.25, 4);
  });
});

describe('reading credit for the app', () => {
  it("gives the free credit once, and no more once the day's limit is reached", async () => {
    const { state, deps } = fakeWorld();
    const first = await creditFor(deps, 'u1');
    expect(first.balancePence).toBe(100);
    expect(first.lastAddedPence).toBe(100);
    expect(first.usdPerPound).toBe(1.25);
    await creditFor(deps, 'u1');
    expect(state.ledger).toBe(100);

    const capped = fakeWorld({ grantsToday: 2 });
    expect((await creditFor(capped.deps, 'u2')).balancePence).toBe(0);
  });
  it('sends one low-credit email per low spell', async () => {
    const { state, deps } = fakeWorld({ ledger: 100, usage: { a: 1.1 } });
    state.rows = [row('a', 1.25)];
    const low = {
      send: async () => {
        state.emails += 1;
      },
    };
    await creditFor(deps, 'u1', low);
    await creditFor(deps, 'u1', low);
    expect(state.emails).toBe(1);
    state.lowNotified = null; // a top-up clears it
    await creditFor(deps, 'u1', low);
    expect(state.emails).toBe(2);
  });
  it('sends nothing when there is plenty', async () => {
    const { state, deps } = fakeWorld({ ledger: 1000 });
    const low = {
      send: async () => {
        state.emails += 1;
      },
    };
    await creditFor(deps, 'u1', low);
    expect(state.emails).toBe(0);
  });
});

describe('minting in credit mode', () => {
  const input = { userId: 'u1', email: 'dana@work.com', deviceId: 'device-aaaa1111' };

  it('gives the free credit and a key worth its share', async () => {
    const { state, deps } = fakeWorld();
    const outcome = await mintCredential(
      { store: deps.credentials, keys: deps.keys, capUsd: 5, now: () => now, credit: deps },
      input,
    );
    expect(outcome.kind).toBe('minted');
    expect(state.ledger).toBe(100);
    // 100p at 1.25 dollars a pound.
    expect(state.created[0]?.limitUsd).toBeCloseTo(1.25, 3);
  });
  it('says capped when the balance is spent', async () => {
    const { state, deps } = fakeWorld({ ledger: 100, usage: { old: 1.25 } });
    state.rows = [{ ...row('old', 1.25, 'device-old00001'), revokedAt: new Date('2026-10-10') }];
    const outcome = await mintCredential(
      { store: deps.credentials, keys: deps.keys, capUsd: 5, now: () => now, credit: deps },
      input,
    );
    expect(outcome.kind).toBe('capped');
    expect(state.created).toHaveLength(0);
  });
  it('a replacement key cannot refill spent credit', async () => {
    const { state, deps } = fakeWorld({ ledger: 100, usage: { old: 0.75 } });
    state.rows = [row('old', 1.25, input.deviceId)];
    const outcome = await mintCredential(
      { store: deps.credentials, keys: deps.keys, capUsd: 5, now: () => now, credit: deps },
      input,
    );
    expect(outcome.kind).toBe('minted');
    // 100p - 60p spent = 40p = $0.50 left, however many keys there are.
    expect(state.created[0]?.limitUsd).toBeCloseTo(0.5, 3);
  });
});
