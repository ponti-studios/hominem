import { db, pool } from '@hominem/db/core';
import { describe, expect, it } from 'vitest';

import {
  ensureSheetAccounts,
  SHEET_ACCOUNT_ADJUSTMENTS,
  SHEET_ACCOUNT_MAP,
  SHEET_BANK_LABELS,
  validateSheetAccountMap,
} from './sheet-accounts';

const userId = 'f3000000-0000-4000-8000-000000000001';

async function seedUser() {
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
    [userId, 'Sheet Accounts User', `${userId}@test.hominem.dev`, true],
  );
  await db.deleteFrom('app.financeTransactions').where('userId', '=', userId).execute();
  await db.deleteFrom('app.financeAccounts').where('userId', '=', userId).execute();
}

describe('sheet account map template', () => {
  it('covers all 28 sheet labels with no extras', () => {
    expect(SHEET_BANK_LABELS).toHaveLength(28);
    expect(Object.keys(SHEET_ACCOUNT_MAP).sort()).toEqual([...SHEET_BANK_LABELS].sort());
  });

  it('quarantines the ambiguous Savings label instead of attributing it', () => {
    expect(SHEET_ACCOUNT_MAP['Savings']).toMatchObject({
      kind: 'create',
      name: 'Savings (Copilot)',
      lifecycleStatus: 'historical',
      includeInNetWorth: false,
    });
  });

  it('preserves the Starling V1 USD quirk as-is on a historical account', () => {
    expect(SHEET_ACCOUNT_MAP['Starling V1']).toMatchObject({
      kind: 'create',
      name: 'Starling 2017',
      currencyCode: 'USD',
      lifecycleStatus: 'historical',
    });
  });

  it('marks closed accounts historical and fixes the Starling currency', () => {
    expect(SHEET_ACCOUNT_ADJUSTMENTS.markHistorical).toEqual(
      expect.arrayContaining(['Monzo', 'Citi Double Cash Card', 'Citi Rewards+ Card']),
    );
    expect(SHEET_ACCOUNT_ADJUSTMENTS.currencyFixes).toContainEqual({
      name: 'Starling Personal',
      currencyCode: 'GBP',
    });
  });
});

describe('validateSheetAccountMap', () => {
  const liveAccounts = [
    { id: 'a1', name: 'American Express Gold' },
    { id: 'a2', name: 'Monzo' },
  ];

  it('reports missing labels and unknown targets', () => {
    const map: Record<string, (typeof SHEET_ACCOUNT_MAP)[string] | undefined> = {
      ...SHEET_ACCOUNT_MAP,
    };
    delete map['Cash'];
    const present: Record<string, (typeof SHEET_ACCOUNT_MAP)[string]> = {};
    for (const [label, resolution] of Object.entries(map)) {
      if (resolution) present[label] = resolution;
    }
    const result = validateSheetAccountMap(present, liveAccounts);
    expect(result.missingLabels).toEqual(['Cash']);
    expect(result.unknownTargets.length).toBeGreaterThan(0);
    expect(result.ok).toBe(false);
  });

  it('rejects create-specs with missing required fields', () => {
    const map = {
      ...SHEET_ACCOUNT_MAP,
      'Wise GBP …0895': { kind: 'create', name: 'Wise GBP' },
    };
    const result = validateSheetAccountMap(map, liveAccounts);
    expect(result.invalidSpecs.length).toBeGreaterThan(0);
    expect(result.ok).toBe(false);
  });

  it('passes a fully resolvable map', () => {
    const live = [
      ...liveAccounts,
      ...SHEET_BANK_LABELS.flatMap((label, i) => {
        const resolution = SHEET_ACCOUNT_MAP[label];
        return resolution.kind === 'map' ? [{ id: `live-${i}`, name: resolution.name }] : [];
      }),
      { id: 'starling', name: 'Starling Personal' },
    ];
    const result = validateSheetAccountMap(SHEET_ACCOUNT_MAP, live);
    expect({ ...result, warnings: undefined }).toMatchObject({
      missingLabels: [],
      unknownTargets: [],
      invalidSpecs: [],
      ok: true,
    });
  });
});

describe('ensureSheetAccounts', () => {
  it('creates, flips, and fixes idempotently, owner-scoped', async () => {
    await seedUser();
    const first = await ensureSheetAccounts(userId, {
      labels: {
        'Wise GBP …0895': {
          kind: 'create',
          name: 'Wise GBP',
          accountType: 'checking',
          currencyCode: 'GBP',
          lifecycleStatus: 'open',
          includeInNetWorth: true,
        },
        Monzo: { kind: 'map', name: 'Monzo' },
      },
      adjustments: {
        markHistorical: ['Monzo'],
        currencyFixes: [{ name: 'Wise GBP', currencyCode: 'GBP' }],
      },
    });
    expect(first.created).toEqual(['Wise GBP']);
    const monzo = await db
      .selectFrom('app.financeAccounts')
      .select(['lifecycleStatus', 'includeInNetWorth'])
      .where('userId', '=', userId)
      .where('name', '=', 'Monzo')
      .executeTakeFirst();
    expect(monzo).toBeUndefined();

    await db
      .insertInto('app.financeAccounts')
      .values({
        id: 'f3000003-0000-4000-8000-000000000001',
        userId,
        name: 'Monzo',
        accountType: 'checking',
        currencyCode: 'GBP',
        lifecycleStatus: 'open',
        includeInNetWorth: true,
        metadata: {},
      })
      .execute();
    const second = await ensureSheetAccounts(userId, {
      labels: {
        'Wise GBP …0895': {
          kind: 'create',
          name: 'Wise GBP',
          accountType: 'checking',
          currencyCode: 'GBP',
          lifecycleStatus: 'open',
          includeInNetWorth: true,
        },
        Monzo: { kind: 'map', name: 'Monzo' },
      },
      adjustments: {
        markHistorical: ['Monzo'],
        currencyFixes: [{ name: 'Wise GBP', currencyCode: 'GBP' }],
      },
    });
    expect(second.created).toEqual([]);
    const flipped = await db
      .selectFrom('app.financeAccounts')
      .select(['lifecycleStatus', 'includeInNetWorth'])
      .where('userId', '=', userId)
      .where('name', '=', 'Monzo')
      .executeTakeFirstOrThrow();
    expect(flipped.lifecycleStatus).toBe('historical');
    expect(flipped.includeInNetWorth).toBe(false);
  });
});
