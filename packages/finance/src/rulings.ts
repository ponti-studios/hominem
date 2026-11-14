import { createHash } from 'node:crypto';

/** A ledger row as captured during preparation; amounts are signed minor units. */
export type RulingTransaction = {
  id: string;
  externalId: string | null;
  description: string;
  postedOn: string;
  amountCents: number;
  currencyCode: string;
  excluded: boolean;
  before?: {
    accountId: string;
    accountName: string;
    categoryId: string | null;
    categoryName: string | null;
    tags: string[];
    source: string | null;
    pending: boolean;
  };
};

export type RulingCluster = {
  id: string;
  merchant: string;
  lane: 'live' | 'archive';
  rows: RulingTransaction[];
  totals: Record<string, number>;
  firstDate: string;
  lastDate: string;
  examples: RulingTransaction[];
  canFile: boolean;
  proposal?: RulingProposal | null;
};

export type RulingProposal = {
  category: string;
  tags: string[];
  reason: string;
  source: 'rulebook' | 'history';
};

export type RulingRulebook = {
  categories: string[];
  tags: string[];
  merchantRules: Array<{ merchant: string; category: string; tags: string[] }>;
  categoryRules: Array<{ pattern: string; category: string }>;
  tagRules: Array<{ pattern: string; tags: string[] }>;
  coffeePatterns: string[];
};

/** Prefer explicit rulebook matches; use stable transaction history as a fallback. */
export function proposeRuling(
  cluster: RulingCluster,
  rulebook: RulingRulebook | null,
  history: RulingTransaction[],
): RulingProposal | null {
  if (rulebook) {
    const merchantRule = rulebook.merchantRules.find(
      (rule) => normalizeRulingMerchant(rule.merchant) === cluster.merchant,
    );
    if (merchantRule)
      return {
        category: merchantRule.category,
        tags: [...merchantRule.tags],
        reason: 'Matched the reference merchant rule.',
        source: 'rulebook',
      };

    const exampleText = cluster.examples.map((row) => row.description.toLowerCase()).join(' ');
    const categoryRule = rulebook.categoryRules.find((rule) =>
      exampleText.includes(rule.pattern.toLowerCase()),
    );
    const tagRules = rulebook.tagRules.filter((rule) =>
      exampleText.includes(rule.pattern.toLowerCase()),
    );
    const coffeeMatch = rulebook.coffeePatterns.some((pattern) =>
      exampleText.includes(pattern.toLowerCase()),
    );
    const tags = [...new Set(tagRules.flatMap((rule) => rule.tags))];
    if (coffeeMatch && rulebook.tags.some((tag) => tag.toLowerCase() === 'coffee'))
      tags.push('Coffee');
    if (categoryRule && rulebook.categories.includes(categoryRule.category))
      return {
        category: categoryRule.category,
        tags: [...new Set(tags)],
        reason: 'Matched the reference category rule.',
        source: 'rulebook',
      };
  }

  const matches = history.filter(
    (row) =>
      !row.excluded &&
      !row.before?.pending &&
      normalizeRulingMerchant(row.description) === cluster.merchant &&
      row.before?.categoryName &&
      !['uncategorized', 'adjustment'].includes(row.before.categoryName.toLowerCase()),
  );
  const groups = new Map<string, { category: string; tags: string[]; count: number }>();
  for (const row of matches) {
    const category = row.before!.categoryName!;
    const tags = [...row.before!.tags].sort();
    const key = JSON.stringify([category, tags]);
    const group = groups.get(key) ?? { category, tags, count: 0 };
    group.count++;
    groups.set(key, group);
  }
  const best = [...groups.values()].sort((a, b) => b.count - a.count)[0];
  if (!best || best.count < 3 || best.count / matches.length < 0.8) return null;
  return {
    category: best.category,
    tags: best.tags,
    reason: `Previously filed as ${[best.category, ...best.tags].join(' / ')} ${best.count} times.`,
    source: 'history',
  };
}

/** Mirrors the sync's normalized key; processor prefixes are removed conservatively. */
export function normalizeRulingMerchant(description: string): string {
  return description
    .toLowerCase()
    .trim()
    .replace(/^(?:sq\s*\*|tst\s*\*)\s*/i, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Build stable clusters without combining amounts denominated in different currencies. */
export function clusterRulingTransactions(rows: RulingTransaction[]): RulingCluster[] {
  const groups = new Map<string, RulingTransaction[]>();
  for (const row of rows) {
    if (row.excluded) continue;
    const key = normalizeRulingMerchant(row.description) || `unidentified ${row.id}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([merchant, group]) => {
    const sorted = [...group].sort(
      (a, b) => b.postedOn.localeCompare(a.postedOn) || a.id.localeCompare(b.id),
    );
    const totals: Record<string, number> = {};
    for (const row of sorted)
      totals[row.currencyCode] = (totals[row.currencyCode] ?? 0) + row.amountCents;
    return {
      id: createHash('sha256').update(merchant).digest('hex'),
      merchant,
      lane: sorted[0]!.postedOn >= '2026-09-01' ? 'live' : 'archive',
      rows: sorted,
      totals,
      firstDate: sorted[sorted.length - 1]!.postedOn,
      lastDate: sorted[0]!.postedOn,
      examples: sorted.slice(0, 5),
      canFile: sorted.every(
        (row) =>
          Boolean(row.externalId) &&
          (!row.before || (Boolean(row.before.source) && !row.before.pending)),
      ),
    };
  });
}
