/**
 * The categorization engine. Every rule lives in the Hominem doctrine
 * (app.finance_sync_doctrine, fetched at runtime via finance_doctrine_get)
 * — Charles's ruling, 2026-11-22: this repo holds no personal financial
 * data, and dated data rules from Charles are law, not comments to tidy
 * (law 2). Each doctrine rule carries its own provenance note verbatim.
 *
 * Engine order is law (docs/hominem-finance-tools-spec.md §8b):
 *   1. classifyRow — row-class detection: transferMerchants (default
 *      exact match, honored unless the account's own name matches
 *      unlessAccountContains) and incomePatterns (positive amounts
 *      only) run BEFORE any categorization.
 *   2. categorize — amountRules first (exact normalized merchant +
 *      exact signed minor units), then merchantRules in stored order,
 *      first-match-wins.
 *   3. tagsFor — the first matching tagRule sets the tag row, lenses
 *      may then add, and inside Food the coffeePatterns win over other
 *      component tags (WYA-271: a coffee row's only component tag is
 *      Coffee).
 *
 * The archived exact-merchant layer (425 rules in
 * merchant_category_rules.json) was never salvaged — rows it would
 * have matched land Uncategorized and queue for a ruling, never
 * guessed.
 */
import { type DoctrineRule, type MatchMode, type SyncDoctrine } from './types.ts';

/** Lowercase, punctuation → space, whitespace collapsed. */
export function normalizeMerchant(name: string | null | undefined): string {
  const s = (name ?? '').toLowerCase().trim();
  return s
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A doctrine with every list empty — the engine's degenerate mode. */
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

/**
 * One doctrine rule against the normalized merchant name. The pattern
 * is normalized to the same space first, so a pattern stored as
 * "Apple.com" still matches "apple com" — canonical, never guessed. An
 * empty normalized pattern is skipped: it would match everything.
 * Mirrors Hominem's schema defaults: transfer rules match exactly,
 * every other list contains.
 */
function ruleMatches(
  rule: DoctrineRule,
  norm: string,
  defaultMode: MatchMode = 'contains',
): boolean {
  const pattern = normalizeMerchant(rule.pattern);
  if (!pattern) return false;
  switch (rule.matchMode ?? defaultMode) {
    case 'exact':
      return norm === pattern;
    case 'startsWith':
      return norm.startsWith(pattern);
    default:
      return norm.includes(pattern);
  }
}

/**
 * Return "Transfers", "Income", or "" (fall through to merchant rules).
 * Row-class detection, 2026-10-15 (Uncategorized remediation Phase 2):
 * transfers and income classify at ingest so they never land
 * Uncategorized. transferMerchants default to exact match; the
 * unlessAccountContains guard keeps a transfer merchant honest on its
 * own account (Wise on a Wise account is not a movement out).
 */
export function classifyRow(
  merchant: string,
  amountCents: number,
  accountName = '',
  doctrine: SyncDoctrine = EMPTY_DOCTRINE,
): string {
  const m = normalizeMerchant(merchant);
  if (!m) return '';
  const acct = normalizeMerchant(accountName);
  for (const rule of doctrine.transferMerchants) {
    if (!ruleMatches(rule, m, 'exact')) continue;
    if (
      rule.unlessAccountContains &&
      acct.includes(normalizeMerchant(rule.unlessAccountContains))
    ) {
      continue;
    }
    return 'Transfers';
  }
  if (amountCents > 0) {
    for (const rule of doctrine.incomePatterns) {
      if (ruleMatches(rule, m)) return 'Income';
    }
  }
  return '';
}

/**
 * The category for a row: amountRules first (Chase's ruling,
 * 2026-10-23 — some merchants bill for many products, so only known
 * prices auto-map), then merchantRules in stored order, first-match-
 * wins. "" = Uncategorized → queues for a ruling.
 */
export function categorize(
  merchant: string,
  amountCents: number | null | undefined,
  doctrine: SyncDoctrine = EMPTY_DOCTRINE,
): string {
  const norm = normalizeMerchant(merchant);
  if (!norm) return '';
  if (amountCents !== null && amountCents !== undefined) {
    for (const rule of doctrine.amountRules) {
      if (
        normalizeMerchant(rule.merchant) === norm &&
        rule.amountMinorUnits.includes(amountCents)
      ) {
        return rule.category;
      }
    }
  }
  for (const rule of doctrine.merchantRules) {
    if (ruleMatches(rule, norm)) return rule.category;
  }
  return '';
}

/**
 * Tags for a row: the first matching tagRule sets the tag row, the
 * category's lens may then add to it, and inside Food the coffee rule
 * wins over other component tags (WYA-271, 2026-11-02: a coffee/tea
 * row's only component tag is Coffee).
 */
export function tagsFor(
  merchant: string,
  category: string,
  doctrine: SyncDoctrine = EMPTY_DOCTRINE,
): string[] {
  const norm = normalizeMerchant(merchant);
  let tags: string[] = [];
  for (const rule of doctrine.tagRules) {
    if (ruleMatches(rule, norm)) {
      tags = [...rule.tags];
      break;
    }
  }
  for (const lens of doctrine.lenses) {
    if (lens.category !== category) continue;
    for (const m of lens.matches) {
      if (ruleMatches(m, norm) && !tags.includes(m.tag)) tags.push(m.tag);
    }
  }
  if (
    category === 'Food' &&
    doctrine.coffeePatterns.some((p) => {
      const np = normalizeMerchant(p);
      return np !== '' && norm.includes(np);
    })
  ) {
    tags = tags.filter((t) => t !== 'Groceries' && t !== 'Dining Out');
    if (!tags.includes('Coffee')) tags.push('Coffee');
  }
  return tags;
}
