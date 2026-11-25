/**
 * Shared row shapes for the wealth sync. The archived Python passed
 * positional 9-tuples around; the port names every field so a mis-order
 * can't compile. Field-by-field the contract is unchanged:
 * (date, label, merchant, amount, currency, tags, source, orderNumber,
 * category).
 *
 * Charles's ruling, 2026-11-22: this repo holds no personal financial
 * data. Account routing and the categorization doctrine are not
 * hardcoded here — they resolve from Hominem at runtime (finance_accounts
 * + finance_doctrine_get), and the shapes below mirror Hominem's
 * schemas (services/api/src/schemas/finance.doctrine.schema.ts is the
 * source of truth; keep them in lockstep).
 */

/** One pulled row, pre-import. */
export interface SyncRow {
  /** postedOn, YYYY-MM-DD. */
  date: string;
  /**
   * The routing label. Provisional from the feed (e.g. `Starling 11111111`,
   * `Synth Bank Synth Card …4242`) until routeRow matches the row to a
   * Hominem account, then the account's display name.
   */
  label: string;
  /** Hominem account UUID once routed; undefined = hold out, never guess. */
  accountId?: string;
  /** Bank-side routing identity; see RouteIdentity. */
  route?: RouteIdentity;
  /** Why an unrouted row was held out — banked with the pending row. */
  holdoutReason?: string;
  /** Merchant text; becomes the Hominem description. */
  merchant: string;
  /** Signed, 2dp; negative = outflow (Hominem's convention). */
  amount: number;
  currency: string;
  tags: string[];
  /** 'Starling API' | 'Plaid' — mapped to the Hominem `source` at import. */
  source: string;
  /** Always '' today (the feeds carry no order numbers); kept for fidelity. */
  orderNumber: string;
  /** '' = Uncategorized → lands in the sync's unmapped queue for a ruling. */
  category: string;
}

/**
 * How a row routes to a Hominem account: Starling rows by
 * (provider, providerAccountId) — the bank-side account/saver UID —
 * and Plaid rows by the feed mask, which Hominem stores as the
 * account's accountNumber.
 */
export type RouteIdentity =
  | { provider: 'starling'; providerAccountId: string }
  | { provider: 'plaid'; mask: string };

/** One Hominem account as the sync routes by it (finance_accounts). */
export interface HominemAccount {
  id: string;
  /** Display label — the sheet label; what a routed row's `label` becomes. */
  name: string;
  accountType: string;
  currencyCode: string;
  lifecycleStatus: string;
  /**
   * Decimal balance as the MCP read model returns it (the RPC route
   * returns balanceCents instead — the port reads via MCP). Cards sit
   * negative: owed is -balance.
   */
  balance: number;
  /** Sync provider slug ('starling', 'plaid'); null on manual accounts. */
  provider: string | null;
  /** Bank-side id (Starling account/saver UIDs); the Starling route key. */
  providerAccountId: string | null;
  /** Mask / last digits; the Plaid route key. */
  accountNumber: string | null;
}

/** Pattern match against the normalized merchant name (doctrine default: contains). */
export type MatchMode = 'exact' | 'contains' | 'startsWith';

export interface DoctrineRule {
  matchMode?: MatchMode;
  pattern: string;
  /** Provenance for dated rulings — preserved verbatim, never interpreted. */
  note?: string;
}

/** Ordered, first-match-wins: merchantRules decide the category. */
export interface MerchantRule extends DoctrineRule {
  category: string;
}

/** Ordered: the first matching rule sets the tag row; lenses may then add. */
export interface TagRule extends DoctrineRule {
  tags: string[];
}

/** Exact normalized merchant + exact signed minor units (known prices). */
export interface AmountRule {
  merchant: string;
  amountMinorUnits: number[];
  category: string;
  note?: string;
}

/** Row-class detection, matched before merchant rules, filed as Transfers. */
export interface TransferRule extends DoctrineRule {
  /** Skip the rule when the account's own name contains this. */
  unlessAccountContains?: string;
}

/** Matched on positive amounts only, filed as Income. */
export interface IncomePattern extends DoctrineRule {}

/** Category-scoped: merchants keep their historical subcategory as a tag. */
export interface DoctrineLens {
  category: string;
  matches: (DoctrineRule & { tag: string })[];
}

/**
 * The ingest doctrine — one fingerprinted row per user in Hominem
 * (app.finance_sync_doctrine), served by finance_doctrine_get. Engine
 * order is law: row-class detection (transferMerchants/incomePatterns)
 * runs BEFORE categorization (amountRules → ordered merchantRules,
 * first-match-wins).
 */
export interface SyncDoctrine {
  version: 1;
  merchantRules: MerchantRule[];
  tagRules: TagRule[];
  amountRules: AmountRule[];
  transferMerchants: TransferRule[];
  incomePatterns: IncomePattern[];
  coffeePatterns: string[];
  lenses: DoctrineLens[];
}

/** Natural key, deliberately in cents: (date, label, merchant, cents, currency). */
export function naturalKey(
  r: Pick<SyncRow, 'date' | 'label' | 'merchant' | 'amount' | 'currency'>,
): string {
  return JSON.stringify([r.date, r.label, r.merchant, Math.round(r.amount * 100), r.currency]);
}

/** Round to 2dp the way the archived sync did (Python round(x, 2)). */
export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Signed cents — the Hominem write model's amountCents. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** ISO date minus n days (UTC arithmetic on calendar dates). */
export function isoMinusDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

export function isoPlusDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days between two ISO dates (b - a). */
export function isoDaysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Inclusive first and last day of a YYYY-MM month — the archived
 * `calendar.monthrange`, the close's [from, to] window.
 */
export function monthBounds(month: string): { from: string; to: string } {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** ISO date plus n whole months, day clamped into the target month
 * (the archived add_months: divmod semantics, so negative steps
 * month-rewind correctly too). */
export function isoAddMonths(iso: string, months: number): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const idx = y * 12 + m - 1 + months;
  const ny = Math.floor(idx / 12);
  const nm = (((idx % 12) + 12) % 12) + 1;
  const dim = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`;
}
