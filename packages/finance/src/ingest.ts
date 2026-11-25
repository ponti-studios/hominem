import { z } from 'zod';

import type { DoctrineRule, MatchMode, SyncDoctrine } from './finance.doctrine.schema';
import { toCents } from './utils';

const routeIdentitySchema = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('starling'), providerAccountId: z.string() }),
  z.object({ provider: z.literal('plaid'), mask: z.string() }),
]);

export type RouteIdentity = z.infer<typeof routeIdentitySchema>;

export const syncRowSchema = z.object({
  date: z.iso.date(),
  label: z.string(),
  accountId: z.string().optional(),
  route: routeIdentitySchema.optional(),
  holdoutReason: z.string().optional(),
  merchant: z.string(),
  amount: z.number().finite(),
  currency: z.string(),
  tags: z.array(z.string()),
  source: z.string(),
  orderNumber: z.string(),
  category: z.string(),
  externalId: z.string().nullable().optional(),
});

export type SyncRow = z.infer<typeof syncRowSchema>;

export interface FinanceAccountRoute {
  id: string;
  name: string;
  accountType: string;
  currencyCode: string;
  lifecycleStatus: string;
  balance: number;
  provider: string | null;
  providerAccountId: string | null;
  accountNumber: string | null;
}

export const starlingItemSchema = z.object({
  feedItemUid: z.string().nullable(),
  date: z.iso.date(),
  merchant: z.string(),
  amount: z.number().finite(),
  currency: z.string(),
  direction: z.string(),
  status: z.string().nullable(),
  reference: z.string().nullable(),
  accountUid: z.string().nullable(),
  src: z.string().nullable(),
  space: z.string().nullable(),
});

export type StarlingItem = z.infer<typeof starlingItemSchema>;

export const starlingFeedSchema = z.object({
  accountUid: z.string().min(1),
  currency: z.string().min(1),
  space: z.string().nullable(),
  feedItems: z
    .array(
      z.object({
        feedItemUid: z.string().nullable().optional(),
        transactionTime: z.string().nullable().optional(),
        transactedAt: z.string().nullable().optional(),
        counterPartyName: z.string().nullable().optional(),
        reference: z.string().nullable().optional(),
        source: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        direction: z.string(),
        amount: z.object({
          minorUnits: z.union([z.number().int(), z.string().regex(/^-?\d+$/)]),
          currency: z.string().nullable().optional(),
        }),
      }),
    )
    .max(1000),
});

export type StarlingFeed = z.infer<typeof starlingFeedSchema>;

export const plaidBodySchema = z.object({
  institutions: z
    .array(z.object({ display_name: z.string().optional(), credential_id: z.string().optional() }))
    .optional(),
  accounts: z
    .array(
      z.object({
        account_id: z.string(),
        name: z.string().optional(),
        mask: z.string().nullable().optional(),
        _plaid_source: z.object({ credential_id: z.string().optional() }).optional(),
      }),
    )
    .optional(),
  transactions: z
    .array(
      z.object({
        account_id: z.string(),
        transaction_id: z.string().optional(),
        date: z.iso.date(),
        pending: z.boolean().optional(),
        merchant_name: z.string().nullable().optional(),
        name: z.string(),
        amount: z.number().finite(),
        iso_currency_code: z.string().nullable().optional(),
        unofficial_currency_code: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

export type PlaidBody = z.infer<typeof plaidBodySchema>;

export function naturalKey(
  row: Pick<SyncRow, 'date' | 'label' | 'merchant' | 'amount' | 'currency'>,
): string {
  return JSON.stringify([
    row.date,
    row.label,
    row.merchant,
    Math.round(row.amount * 100),
    row.currency,
  ]);
}

export const EMPTY_DOCTRINE: SyncDoctrine = {
  version: 1,
  merchantRules: [],
  tagRules: [],
  amountRules: [],
  transferMerchants: [],
  incomePatterns: [],
  coffeePatterns: [],
  lenses: [],
};

export function normalizeMerchant(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ruleMatches(
  rule: DoctrineRule,
  merchant: string,
  defaultMode: MatchMode = 'contains',
): boolean {
  const pattern = normalizeMerchant(rule.pattern);
  if (!pattern) return false;
  switch (rule.matchMode ?? defaultMode) {
    case 'exact':
      return merchant === pattern;
    case 'startsWith':
      return merchant.startsWith(pattern);
    case 'contains':
      return merchant.includes(pattern);
  }
}

export function classifyRow(
  merchant: string,
  amountCents: number,
  accountName = '',
  doctrine: SyncDoctrine = EMPTY_DOCTRINE,
): string {
  const normalized = normalizeMerchant(merchant);
  if (!normalized) return '';
  const account = normalizeMerchant(accountName);
  for (const rule of doctrine.transferMerchants) {
    if (!ruleMatches(rule, normalized, 'exact')) continue;
    if (
      rule.unlessAccountContains &&
      account.includes(normalizeMerchant(rule.unlessAccountContains))
    ) {
      continue;
    }
    return 'Transfers';
  }
  if (amountCents > 0) {
    for (const rule of doctrine.incomePatterns) {
      if (ruleMatches(rule, normalized)) return 'Income';
    }
  }
  return '';
}

export function categorize(
  merchant: string,
  amountCents: number | null | undefined,
  doctrine: SyncDoctrine = EMPTY_DOCTRINE,
): string {
  const normalized = normalizeMerchant(merchant);
  if (!normalized) return '';
  if (amountCents !== null && amountCents !== undefined) {
    for (const rule of doctrine.amountRules) {
      if (
        normalizeMerchant(rule.merchant) === normalized &&
        rule.amountMinorUnits.includes(amountCents)
      ) {
        return rule.category;
      }
    }
  }
  for (const rule of doctrine.merchantRules) {
    if (ruleMatches(rule, normalized)) return rule.category;
  }
  return '';
}

export function tagsFor(
  merchant: string,
  category: string,
  doctrine: SyncDoctrine = EMPTY_DOCTRINE,
): string[] {
  const normalized = normalizeMerchant(merchant);
  let tags: string[] = [];
  for (const rule of doctrine.tagRules) {
    if (ruleMatches(rule, normalized)) {
      tags = [...rule.tags];
      break;
    }
  }
  for (const lens of doctrine.lenses) {
    if (lens.category !== category) continue;
    for (const match of lens.matches) {
      if (ruleMatches(match, normalized) && !tags.includes(match.tag)) tags.push(match.tag);
    }
  }
  if (
    category === 'Food' &&
    doctrine.coffeePatterns.some((pattern) => {
      const normalizedPattern = normalizeMerchant(pattern);
      return normalizedPattern !== '' && normalized.includes(normalizedPattern);
    })
  ) {
    tags = tags.filter((tag) => tag !== 'Groceries' && tag !== 'Dining Out');
    if (!tags.includes('Coffee')) tags.push('Coffee');
  }
  return tags;
}

export function routeRow(
  row: SyncRow,
  accounts: FinanceAccountRoute[],
): { ok: boolean; account?: FinanceAccountRoute; reason?: string } {
  const route = row.route;
  if (!route) return { ok: false, reason: 'row carries no routing identity' };
  if (route.provider === 'starling') {
    const matches = accounts.filter(
      (account) =>
        account.provider === 'starling' && account.providerAccountId === route.providerAccountId,
    );
    if (matches.length === 1) return { ok: true, account: matches[0] };
    return {
      ok: false,
      reason:
        matches.length === 0
          ? `no hominem account with (provider starling, provider_account_id ${route.providerAccountId})`
          : `ambiguous starling identity ${route.providerAccountId}: ${matches.length} accounts match`,
    };
  }

  const matches = accounts.filter((account) => account.accountNumber === route.mask);
  if (matches.length === 1) return { ok: true, account: matches[0] };
  return {
    ok: false,
    reason:
      matches.length === 0
        ? `no hominem account with account_number ${route.mask}`
        : `ambiguous mask ${route.mask}: ${matches.length} accounts match`,
  };
}

export function starlingItemsToRows(items: StarlingItem[], doctrine: SyncDoctrine): SyncRow[] {
  const rows: SyncRow[] = [];
  for (const item of items) {
    if (item.status !== 'SETTLED') continue;
    const uid = item.accountUid ?? '';
    const label = uid ? `Starling ${uid.slice(0, 8)}` : 'Starling (no account uid)';
    let merchant = item.merchant;
    let category: string;
    if (item.src === 'INTERNAL_TRANSFER') {
      category = 'Transfers';
      if (item.space) merchant = item.space;
    } else {
      category =
        classifyRow(merchant, toCents(item.amount), label, doctrine) ||
        categorize(merchant, toCents(item.amount), doctrine);
    }
    rows.push({
      date: item.date,
      label,
      route: uid ? { provider: 'starling', providerAccountId: uid } : undefined,
      merchant,
      amount: item.amount,
      currency: item.currency,
      tags: tagsFor(merchant, category, doctrine),
      source: 'Starling API',
      orderNumber: '',
      category,
      externalId: item.feedItemUid,
    });
  }
  return rows;
}

export function starlingFeedsToItems(feeds: StarlingFeed[]): StarlingItem[] {
  return feeds.flatMap((feed) =>
    feed.feedItems.map((item) =>
      starlingItemSchema.parse({
        feedItemUid: item.feedItemUid ?? null,
        date: (item.transactionTime ?? item.transactedAt ?? '').slice(0, 10),
        merchant: item.counterPartyName ?? item.reference ?? item.source ?? '',
        amount: (item.direction === 'OUT' ? -1 : 1) * (Number(item.amount.minorUnits) / 100),
        currency: item.amount.currency ?? feed.currency,
        direction: item.direction,
        status: item.status ?? null,
        reference: item.reference ?? null,
        accountUid: feed.accountUid,
        src: item.source ?? null,
        space: feed.space,
      }),
    ),
  );
}

export function plaidItemsToRows(body: PlaidBody, doctrine: SyncDoctrine): SyncRow[] {
  const institutions = new Map(
    (body.institutions ?? []).map((institution) => [
      institution.credential_id ?? '',
      institution.display_name ?? '',
    ]),
  );
  const accounts = new Map(
    (body.accounts ?? []).map((account) => [
      account.account_id,
      {
        institution: institutions.get(account._plaid_source?.credential_id ?? '') ?? '',
        name: account.name ?? '',
        mask: account.mask ?? '',
      },
    ]),
  );
  const rows: SyncRow[] = [];
  for (const transaction of body.transactions ?? []) {
    if (transaction.pending) continue;
    const account = accounts.get(transaction.account_id) ?? {
      institution: '',
      name: '',
      mask: '',
    };
    const label = `${account.institution} ${account.name} …${account.mask}`.trim();
    const merchant = transaction.merchant_name ?? transaction.name;
    const amount = Math.round(-transaction.amount * 100) / 100;
    const category =
      classifyRow(merchant, toCents(amount), label, doctrine) ||
      categorize(merchant, toCents(amount), doctrine);
    rows.push({
      date: transaction.date,
      label,
      route: account.mask ? { provider: 'plaid', mask: account.mask } : undefined,
      merchant,
      amount,
      currency: transaction.iso_currency_code ?? transaction.unofficial_currency_code ?? '',
      tags: tagsFor(merchant, category, doctrine),
      source: 'Plaid',
      orderNumber: '',
      category,
      externalId: transaction.transaction_id ?? null,
    });
  }
  return rows;
}
