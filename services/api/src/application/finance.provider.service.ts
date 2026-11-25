import { ValidationError } from '@hominem/db/errors';
import { createOrGetAccount } from '@hominem/finance-services';
import type { z } from 'zod';

import type {
  financeBalancesInputSchema,
  financeSeedInputSchema,
} from '../schemas/finance.provider.schema';
import { financeAccountCreateInputSchema } from '../schemas/finance.schema';
import { importSyncDoctrine } from './finance.doctrine.service';

export async function financeSeed(userId: string, input: z.output<typeof financeSeedInputSchema>) {
  const doctrine = input.doctrine
    ? await importSyncDoctrine(userId, { doctrine: input.doctrine })
    : null;
  const accounts = [];
  for (const account of input.accounts) {
    const type = (account.accountType ?? '').toUpperCase();
    const accountType = type.includes('SAVING') || type.includes('GOAL') ? 'savings' : 'checking';
    const request = financeAccountCreateInputSchema.parse({
      name: account.name ?? account.accountUid.slice(0, 8),
      currencyCode: account.currency,
      provider: 'starling',
      providerAccountId: account.accountUid,
      accountType,
    });
    const saved = await createOrGetAccount({ userId, ...request });
    if (
      !saved.id ||
      saved.provider !== 'starling' ||
      saved.providerAccountId !== account.accountUid
    ) {
      throw new ValidationError(
        `Account "${request.name}" already exists without the requested Starling identity; link it explicitly before seeding.`,
      );
    }
    accounts.push({
      name: saved.name,
      provider_account_id: saved.providerAccountId,
      created: saved.created,
      id: saved.id,
    });
  }
  return {
    ok: true,
    doctrine: doctrine
      ? {
          status: doctrine.status,
          fingerprint: doctrine.fingerprint,
          ruleCounts: doctrine.ruleCounts,
        }
      : null,
    ...(!doctrine
      ? {
          doctrine_note:
            'no WEALTH_SEED_DOCTRINE set — merchants land Uncategorized and queue for a ruling; import one with finance_doctrine_import or re-run the seed',
        }
      : {}),
    accounts,
  };
}

const SYMBOLS: Record<string, string> = { GBP: '£', USD: '$' };

function minorToMajor(money: { minorUnits: number | string } | null | undefined): number {
  return Math.round((Number(money?.minorUnits ?? 0) / 100) * 100) / 100;
}

function fmtMoney(currency: string, value: number): string {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const amount = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? '-' : ''}${symbol}${amount}`;
}

export function financeBalances(input: z.output<typeof financeBalancesInputSchema>) {
  const accounts = input.accounts.map(({ account, balance, savingsGoalList }) => ({
    accountUid: account.accountUid,
    name: account.name ?? account.accountUid.slice(0, 8),
    accountType: account.accountType ?? '',
    currency: balance.currency ?? account.currency,
    cleared: minorToMajor(balance.clearedBalance),
    effective: minorToMajor(balance.effectiveBalance),
    pending: minorToMajor(balance.pendingTransactions),
    overdraft: minorToMajor(balance.acceptedOverdraft),
    spaces: savingsGoalList.map((goal) => ({
      name: goal.name ?? goal.savingsGoalUid ?? 'Space',
      saved: minorToMajor(goal.totalSaved),
      target: goal.target ? minorToMajor(goal.target) : null,
    })),
  }));
  const totals = new Map<string, number>();
  const text = [`Starling balances — ${input.at}`];
  if (!accounts.length) text.push('', 'No balances to report.');
  for (const account of accounts) {
    const spacesTotal = account.spaces.reduce((sum, space) => sum + space.saved, 0);
    totals.set(
      account.currency,
      Math.round(((totals.get(account.currency) ?? 0) + account.cleared + spacesTotal) * 100) / 100,
    );
    text.push('', `${account.name} (${account.currency})`);
    text.push(`  ${'Cleared:'.padEnd(18)}${fmtMoney(account.currency, account.cleared)}`);
    text.push(`  ${'Effective:'.padEnd(18)}${fmtMoney(account.currency, account.effective)}`);
    text.push(`  ${'Pending:'.padEnd(18)}${fmtMoney(account.currency, account.pending)}`);
    text.push(`  ${'Overdraft limit:'.padEnd(18)}${fmtMoney(account.currency, account.overdraft)}`);
    if (account.spaces.length) {
      text.push('  Spaces:');
      for (const space of account.spaces) {
        const target =
          space.target === null ? '' : ` (target ${fmtMoney(account.currency, space.target)})`;
        text.push(
          `    ${space.name.padEnd(16)}  ${fmtMoney(account.currency, space.saved)}${target}`,
        );
      }
    }
    text.push(
      `  ${'Cleared + Spaces:'.padEnd(18)}${fmtMoney(account.currency, account.cleared + spacesTotal)}`,
    );
  }
  if (totals.size) {
    text.push('', 'All accounts, cleared + Spaces:');
    for (const [currency, total] of [...totals].sort()) {
      text.push(`  ${currency}: ${fmtMoney(currency, total)}`);
    }
  }
  if (input.notes.length) text.push('', 'Notes:', ...input.notes.map((note) => `  - ${note}`));
  return {
    accounts,
    totals: [...totals].sort().map(([currency, total]) => ({ currency, total })),
    notes: input.notes,
    text: text.join('\n'),
  };
}
