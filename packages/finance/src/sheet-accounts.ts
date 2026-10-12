import crypto from 'node:crypto';

import { db } from '@hominem/db/core';

export const SHEET_BANK_LABELS = [
  'American Express Gold',
  'Apple Cash',
  "Lloyd's Platinum Current",
  'Apple Card',
  'Amex Platinum …4009',
  'Capital One 360 Checking …9015',
  'Capital One VentureOne …9645',
  'Capital One Quicksilver …0844',
  'Starling V1',
  'Santander Premier Plus Checking',
  'Savings',
  'Capital One Savor …1488',
  'Capital One 360 Money Market',
  'Capital One 360 Savings …3196',
  'Charles Schwab Investor Checking',
  'Starling Personal',
  'High Yield Savings …4217',
  "Lloyd's Platinum Savings",
  'Bending Spoons 401(k) Plan',
  'Barclays View',
  'Monzo',
  'Rewards Checking …4062',
  'Citi Double Cash Card',
  'Citi Rewards+ Card',
  'Wise GBP …0895',
  'Capital One 360 Checking',
  'Cash',
  'Capital One 360 Performance Savings',
];

export type SheetLabelResolution =
  | { kind: 'map'; name: string }
  | {
      kind: 'create';
      name: string;
      accountType: string;
      currencyCode: string;
      lifecycleStatus: string;
      includeInNetWorth: boolean;
    };

export interface SheetAccountAdjustments {
  markHistorical: string[];
  currencyFixes: Array<{ name: string; currencyCode: string }>;
}

export interface SheetAccountPlan {
  labels: Record<string, SheetLabelResolution>;
  adjustments: SheetAccountAdjustments;
}

function direct(name: string): SheetLabelResolution {
  return { kind: 'map', name };
}

export const SHEET_ACCOUNT_MAP: Record<string, SheetLabelResolution> = {
  'American Express Gold': direct('American Express Gold'),
  'Apple Cash': direct('Apple Cash'),
  "Lloyd's Platinum Current": direct("Lloyd's Platinum Current"),
  'Apple Card': direct('Apple Card'),
  'Amex Platinum …4009': direct('American Express Platinum'),
  'Capital One 360 Checking …9015': direct('Capital One 360 Checking …9015'),
  'Capital One VentureOne …9645': direct('Capital One VentureOne …9645'),
  'Capital One Quicksilver …0844': direct('Capital One Quicksilver …0844'),
  'Starling V1': {
    kind: 'create',
    name: 'Starling 2017',
    accountType: 'checking',
    currencyCode: 'USD',
    lifecycleStatus: 'historical',
    includeInNetWorth: false,
  },
  'Santander Premier Plus Checking': direct('Santander Premier Plus Checking'),
  Savings: {
    kind: 'create',
    name: 'Savings (Copilot)',
    accountType: 'savings',
    currencyCode: 'USD',
    lifecycleStatus: 'historical',
    includeInNetWorth: false,
  },
  'Capital One Savor …1488': direct('Capital One Savor …1488'),
  'Capital One 360 Money Market': {
    kind: 'create',
    name: 'Capital One 360 Money Market',
    accountType: 'savings',
    currencyCode: 'USD',
    lifecycleStatus: 'historical',
    includeInNetWorth: false,
  },
  'Capital One 360 Savings …3196': {
    kind: 'create',
    name: 'Capital One 360 Savings',
    accountType: 'savings',
    currencyCode: 'USD',
    lifecycleStatus: 'open',
    includeInNetWorth: true,
  },
  'Charles Schwab Investor Checking': direct('Charles Schwab Investor Checking'),
  'Starling Personal': direct('Starling Personal'),
  'High Yield Savings …4217': {
    kind: 'create',
    name: 'High Yield Savings …4217',
    accountType: 'savings',
    currencyCode: 'USD',
    lifecycleStatus: 'historical',
    includeInNetWorth: false,
  },
  "Lloyd's Platinum Savings": direct("Lloyd's Platinum Savings"),
  'Bending Spoons 401(k) Plan': direct('Bending Spoons 401(k) Plan'),
  'Barclays View': direct('Barclays View'),
  Monzo: direct('Monzo'),
  'Rewards Checking …4062': direct('Rewards Checking …4062'),
  'Citi Double Cash Card': direct('Citi Double Cash Card'),
  'Citi Rewards+ Card': direct('Citi Rewards+ Card'),
  'Wise GBP …0895': {
    kind: 'create',
    name: 'Wise GBP',
    accountType: 'checking',
    currencyCode: 'GBP',
    lifecycleStatus: 'open',
    includeInNetWorth: true,
  },
  'Capital One 360 Checking': direct('Capital One 360 Checking'),
  Cash: direct('Cash'),
  'Capital One 360 Performance Savings': direct('Capital One 360 Performance Savings'),
};

export const SHEET_ACCOUNT_ADJUSTMENTS: SheetAccountAdjustments = {
  markHistorical: ['Monzo', 'Citi Double Cash Card', 'Citi Rewards+ Card'],
  currencyFixes: [{ name: 'Starling Personal', currencyCode: 'GBP' }],
};

export const SHEET_ACCOUNT_PLAN: SheetAccountPlan = {
  labels: SHEET_ACCOUNT_MAP,
  adjustments: SHEET_ACCOUNT_ADJUSTMENTS,
};

export interface SheetMapValidation {
  ok: boolean;
  missingLabels: string[];
  unknownTargets: string[];
  invalidSpecs: Array<{ label: string; reason: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const CREATE_SPEC_FIELDS = [
  'name',
  'accountType',
  'currencyCode',
  'lifecycleStatus',
  'includeInNetWorth',
] as const;

export function validateSheetAccountMap(
  labels: Record<string, unknown>,
  liveAccounts: Array<{ id: string; name: string }>,
  adjustments: SheetAccountAdjustments = SHEET_ACCOUNT_ADJUSTMENTS,
): SheetMapValidation {
  const missingLabels = SHEET_BANK_LABELS.filter((label) => !(label in labels));
  const liveNames = new Set(liveAccounts.map((account) => account.name.toLowerCase()));
  const unknownTargets: string[] = [];
  const invalidSpecs: Array<{ label: string; reason: string }> = [];

  for (const [label, resolution] of Object.entries(labels)) {
    if (!isRecord(resolution) || typeof resolution.kind !== 'string') {
      invalidSpecs.push({ label, reason: 'resolution must be an object with a kind' });
      continue;
    }
    if (resolution.kind === 'map') {
      if (typeof resolution.name !== 'string' || !resolution.name.trim()) {
        invalidSpecs.push({ label, reason: 'map resolution needs a name' });
      } else if (!liveNames.has(resolution.name.toLowerCase())) {
        unknownTargets.push(label);
      }
    } else if (resolution.kind === 'create') {
      const missing = CREATE_SPEC_FIELDS.filter((field) => {
        const value = resolution[field];
        if (value === undefined || value === null) return true;
        return typeof value === 'string' && !value.trim();
      });
      if (missing.length > 0) {
        invalidSpecs.push({ label, reason: `create-spec missing: ${missing.join(', ')}` });
      }
    } else {
      invalidSpecs.push({ label, reason: `unknown kind: ${resolution.kind}` });
    }
  }
  for (const name of adjustments.markHistorical) {
    if (!liveNames.has(name.toLowerCase())) unknownTargets.push(`flip:${name}`);
  }
  for (const fix of adjustments.currencyFixes) {
    if (!liveNames.has(fix.name.toLowerCase())) unknownTargets.push(`fix:${fix.name}`);
  }
  return {
    ok: missingLabels.length === 0 && unknownTargets.length === 0 && invalidSpecs.length === 0,
    missingLabels,
    unknownTargets,
    invalidSpecs,
  };
}

export interface SheetEnsureReport {
  created: string[];
  flipped: string[];
  currencyFixed: string[];
}

async function findAccountId(userId: string, name: string): Promise<string | null> {
  const row = await db
    .selectFrom('app.financeAccounts')
    .select('id')
    .where('userId', '=', userId)
    .where('name', '=', name)
    .limit(1)
    .executeTakeFirst();
  return row?.id ?? null;
}

export async function ensureSheetAccounts(
  userId: string,
  plan: SheetAccountPlan = SHEET_ACCOUNT_PLAN,
): Promise<SheetEnsureReport> {
  const report: SheetEnsureReport = { created: [], flipped: [], currencyFixed: [] };

  for (const resolution of Object.values(plan.labels)) {
    if (resolution.kind !== 'create') continue;
    const existingId = await findAccountId(userId, resolution.name);
    if (existingId) continue;
    await db
      .insertInto('app.financeAccounts')
      .values({
        id: crypto.randomUUID(),
        userId,
        name: resolution.name,
        accountType: resolution.accountType,
        currencyCode: resolution.currencyCode,
        lifecycleStatus: resolution.lifecycleStatus,
        includeInNetWorth: resolution.includeInNetWorth,
        metadata: {},
      })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();
    report.created.push(resolution.name);
  }

  for (const name of plan.adjustments.markHistorical) {
    const id = await findAccountId(userId, name);
    if (!id) continue;
    await db
      .updateTable('app.financeAccounts')
      .set({ lifecycleStatus: 'historical', includeInNetWorth: false })
      .where('id', '=', id)
      .where('userId', '=', userId)
      .execute();
    report.flipped.push(name);
  }

  for (const fix of plan.adjustments.currencyFixes) {
    const id = await findAccountId(userId, fix.name);
    if (!id) continue;
    await db
      .updateTable('app.financeAccounts')
      .set({ currencyCode: fix.currencyCode })
      .where('id', '=', id)
      .where('userId', '=', userId)
      .execute();
    report.currencyFixed.push(fix.name);
  }

  return report;
}
