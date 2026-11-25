#!/usr/bin/env node
/**
 * Layer 4 — the Monthly Close (WYA-230), ported 2026-11-22 from
 * archive systems-live/wealth-manager/monthly_close.py. Month-end
 * companion to Layer 1 (integrity), Layer 2 (Morning Brief, daily) and
 * Layer 3 (Forward Look, weekly). Where the Brief is exception-led and
 * daily, the Close is complete and monthly: it states the whole month,
 * once, from Hominem (the system of record), and keeps the tax flags
 * that accumulate through the month in one place so deadlines stop
 * arriving as surprises. Read-only: this routine writes nothing to
 * Hominem. It is the one layer whose deliverable is the markdown
 * statement itself, not a JSON envelope — the strings below are the
 * contract and are kept verbatim (em dashes, →, − and all).
 *
 * Sections (per the WYA-230 spec):
 *   (a) Month summary — income vs spend vs budget by category, savings
 *       rate. Income is the Income category (posted, non-excluded) —
 *       the same convention as the Morning Brief. Spend is
 *       finance_spending_by_category with Transfers and Adjustment
 *       excluded (money plumbing and balance plugs, not spending).
 *       GBP is primary; USD is reported in USD and never blended into
 *       GBP — currencies are converted only where a stated FX basis
 *       exists (the filed net-worth baseline, quoted as filed).
 *       Budgets are Hominem data (finance_budget_list status rows,
 *       monthly cadence, amounts only — that tool's spent figures
 *       describe its CURRENT period, so month actuals always come from
 *       finance_spending_by_category). Per the WYA-271 rule, a
 *       category budget is the hard line; nested tag budgets
 *       (Food: Groceries / Dining Out / Coffee) are composition only,
 *       computed disjointly with the Morning Brief priority
 *       Coffee > Dining Out > Groceries.
 *   (b) Net-worth position — Hominem keeps NO historical net-worth
 *       snapshots, so no month-boundary delta is computed or implied.
 *       The section states the labelled anchors from
 *       monthly_close_anchors.json, the current finance_net_worth
 *       position at run time, and the month's net cash flow as a
 *       movement figure (cash flow is not net-worth change: balances
 *       also move via transfers, FX and plugs, which are excluded
 *       here).
 *   (c) Tax flags accumulated — Business-tagged spend total and rows
 *       (finance_tag_breakdown + tag-filtered search), the Taxes &
 *       Fees category, the month's income sources (to spot anything
 *       Self-Assessment-relevant), and the standing tax-status lines
 *       maintained in monthly_close_anchors.json.
 *   (d) Uncategorized residue — the month's posted, non-excluded
 *       Uncategorized spend rows: count, totals per currency, and the
 *       rows themselves. Excluded rows sitting in the category
 *       (balance plugs) are counted separately; they are not residue.
 *
 * Cross-checks run every time: finance_monthly_stats (its totals are
 * transfer-inclusive by design, so they are expected to differ — the
 * difference is reported, not reconciled away), and, when a hygiene
 * check cache exists for the month
 * (monthly_check_<month>_data.json, from the first-Friday check), a
 * per-category diff of spend totals so any recategorisation since that
 * check is named, never smoothed over.
 *
 * Unlike Layers 2 and 3 (partial-ok), ANY tool failure fails the
 * whole close — the archived sh() raised, and a statement with a hole
 * in it is worse than no statement. Failures print {ok:false, error}
 * and exit 1. An invalid month is a usage error: exit 2 before any
 * audit row is written.
 *
 * Deliberate deltas from the archive (recorded 2026-11-22):
 *   - The CLI pair became env pins (Layers 2/3 precedent):
 *     WEALTH_CLOSE_MONTH (default: the last complete month before
 *     WEALTH_SYNC_TODAY — stated in the header when the default is
 *     used) and WEALTH_CLOSE_OUT (optional file; unset prints to
 *     stdout only, set writes the file and prints
 *     `wrote <path> (<N> calls)`).
 *   - Per the 2026-11-22 ruling nothing personal is hardcoded: the
 *     dated anchors and tax-status lines moved from the script folder
 *     to $HOMINEM_AGENT_WEALTH_DIR/monthly_close_anchors.json (machine-local,
 *     law 4). Absent degrades with a named note in the Net worth
 *     section where the archive silently skipped; malformed JSON is a
 *     named note where the archive crashed the run.
 *   - The taxonomy.json budget fallback was dropped with the retired
 *     sheet era: budgets are Hominem data, read from the
 *     finance_budget_list `budgets` status rows (monthly cadence,
 *     category rows only — tag status rows are skipped because the
 *     composition is already nested on the category row as
 *     tagBudgets; currencyCode is resolved server-side at read time).
 *   - The hygiene-check cache moved to
 *     $HOMINEM_AGENT_WEALTH_DIR/monthly_check_<month>_data.json and its
 *     absence is a named skip note (the archive was silent); a
 *     malformed cache is a named note, never a crash.
 *   - The ponti_log subprocess (hatch path) became the HominemMcp
 *     HTTP client: every call lands an events row (law 1), the count
 *     still reported in the header as hominem_calls. `date.today()`
 *     became the WEALTH_SYNC_TODAY pin.
 *
 * Env (law 4): HOMINEM_MCP_URL + HOMINEM_MCP_TOKEN (the backbone —
 * missing fails the run by name), HOMINEM_AGENT_WEALTH_DIR (default
 * ~/.hominem/wealth), WEALTH_SYNC_TODAY (pin the run date),
 * WEALTH_CLOSE_MONTH, WEALTH_CLOSE_OUT.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { finishRun, logRun } from '../../log/agent_log.ts';
import { applyEnvDefaults, envOr } from './env.ts';
import {
  HominemMcp,
  type BudgetListResult,
  type HominemSearchRow,
  type MonthlyStatsResult,
  type NetWorthResult,
  type SpendingByCategoryResult,
  type TagBreakdownResult,
} from './hominem.ts';
import { isoAddMonths, monthBounds, round2 } from './types.ts';

const EXCLUDED_CATEGORIES = new Set(['Transfers', 'Adjustment']);
const FOOD_TAG_PRIORITY = ['Coffee', 'Dining Out', 'Groceries'];
const SYMBOLS: Record<string, string> = { GBP: '£', USD: '$' };
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const SEARCH_PAGE = 50;
const SEARCH_MAX_PAGES = 20;

function todayIso(): string {
  return process.env.WEALTH_SYNC_TODAY ?? new Date().toLocaleDateString('en-CA');
}

function wealthDir(): string {
  return envOr('HOMINEM_AGENT_WEALTH_DIR', join(homedir(), '.hominem', 'wealth'));
}

/** The archived f'{abs(amt):,.2f}' — thousands separators, always 2dp. */
function money(cur: string, amt: number): string {
  const sym = SYMBOLS[cur] ?? cur + ' ';
  const fmt = Math.abs(amt).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amt < 0 ? `-${sym}${fmt}` : `${sym}${fmt}`;
}

/** The archived f'{x:,}' — thousands separators, precision as stored. */
function thousands(x: number): string {
  return x.toLocaleString('en-US');
}

function displayName(t: HominemSearchRow): string {
  return t.merchantName || t.description || '(unknown)';
}

/** Tag names, tolerant of the archived str-or-{name} row shapes. */
function tagNames(t: HominemSearchRow): Set<string> {
  const out = new Set<string>();
  for (const tag of (t.tags ?? []) as unknown[]) {
    out.add(typeof tag === 'string' ? tag : String((tag as { name?: string })?.name ?? ''));
  }
  return out;
}

function isSpendRow(t: HominemSearchRow): boolean {
  return !t.excluded && !t.pending && t.amount < 0;
}

// ------------------------------------------------------------------ pulls

interface MonthData {
  spending: SpendingByCategoryResult;
  monthlyStats: MonthlyStatsResult;
  incomeRows: HominemSearchRow[];
  uncatRows: HominemSearchRow[];
  businessBreakdown: TagBreakdownResult;
  businessRows: HominemSearchRow[];
  budgets: BudgetListResult;
  netWorth: NetWorthResult;
  foodRows: HominemSearchRow[];
}

/** Page a finance_transaction_search to exhaustion (page = 50,
 * the archived 20-page guard). */
async function searchAll(
  hominem: HominemMcp,
  args: { categoryName?: string; tag?: string; from: string; to: string },
): Promise<HominemSearchRow[]> {
  const rows: HominemSearchRow[] = [];
  let offset = 0;
  for (let page = 0; page < SEARCH_MAX_PAGES; page++) {
    const res = await hominem.searchTransactions({ ...args, limit: SEARCH_PAGE, offset });
    rows.push(...res.transactions);
    if (res.transactions.length < SEARCH_PAGE) break;
    offset += SEARCH_PAGE;
  }
  return rows;
}

/** All Hominem reads for the close. Any failure throws — the whole
 * close fails (the archived contract: a statement with a hole in it
 * is worse than no statement). */
async function pullMonth(
  hominem: HominemMcp,
  month: string,
  warn: (tool: string, w: string) => void,
): Promise<MonthData> {
  const { from, to } = monthBounds(month);

  const spending = await hominem.spendingByCategory({ from, to, limit: 50 });
  for (const w of spending.warnings) warn('finance_spending_by_category', w);
  if (spending.truncated)
    warn('finance_spending_by_category', 'result truncated — totals may omit categories');

  const monthlyStats = await hominem.monthlyStats(month);
  for (const w of monthlyStats.warnings) warn('finance_monthly_stats', w);

  const incomeRows = (await searchAll(hominem, { categoryName: 'Income', from, to })).filter(
    (t) => !t.excluded && !t.pending && t.amount > 0,
  );
  const uncatRows = await searchAll(hominem, { categoryName: 'Uncategorized', from, to });

  const businessBreakdown = await hominem.tagBreakdown({ from, to, tag: 'Business', limit: 10 });
  for (const w of businessBreakdown.warnings) warn('finance_tag_breakdown', w);
  const businessRows = (await searchAll(hominem, { tag: 'Business', from, to })).filter(isSpendRow);

  const budgets = await hominem.budgetList();
  // The list's singular warning (unset primary currency &c.).
  if (budgets.warning) warn('finance_budget_list', budgets.warning);

  const netWorth = await hominem.netWorth();
  for (const w of netWorth.warnings) warn('finance_net_worth', w);

  const foodRows = await searchAll(hominem, { categoryName: 'Food', from, to });

  return {
    spending,
    monthlyStats,
    incomeRows,
    uncatRows,
    businessBreakdown,
    businessRows,
    budgets,
    netWorth,
    foodRows,
  };
}

// ------------------------------------------------------- machine-local files

interface CloseAnchor {
  date: string;
  label: string;
  /** currency -> filed total. Empty/absent = not filed that way. */
  totals?: Record<string, number>;
  /** A single blended GBP figure, quoted as filed. */
  blended_gbp?: number;
  basis: string;
}

interface AnchorsFile {
  anchors?: CloseAnchor[];
  tax_status?: string[];
}

interface AnchorsState {
  anchors: CloseAnchor[];
  taxStatus: string[];
  /** Named degrade note (absent or malformed file), stated in the
   * Net worth section; null when the file read cleanly. */
  note: string | null;
}

function readAnchors(dir: string): AnchorsState {
  const p = join(dir, 'monthly_close_anchors.json');
  if (!existsSync(p)) {
    return {
      anchors: [],
      taxStatus: [],
      note: '(No monthly_close_anchors.json in the wealth dir — dated anchors and tax-status lines are not filed, so none are stated.)',
    };
  }
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8')) as AnchorsFile;
    return { anchors: parsed.anchors ?? [], taxStatus: parsed.tax_status ?? [], note: null };
  } catch (err) {
    return {
      anchors: [],
      taxStatus: [],
      note: `(monthly_close_anchors.json is malformed — anchors and tax-status lines skipped: ${String((err as Error).message).slice(0, 160)})`,
    };
  }
}

// ------------------------------------------------------------------ tables

interface CatEntry {
  spent: number;
  count: number;
}
type SpendTables = Record<string, Record<string, CatEntry>>;

/** {(cur): {cat: (spent, count)}} with plumbing categories removed. */
function spendTables(d: MonthData): SpendTables {
  const tables: SpendTables = {};
  for (const c of d.spending.categories) {
    if (EXCLUDED_CATEGORIES.has(c.categoryName)) continue;
    const per = (tables[c.currencyCode] ??= {});
    per[c.categoryName] = { spent: c.spent, count: c.transactionCount };
  }
  return tables;
}

/** Disjoint Food tag buckets — the Morning Brief priority rule. */
function foodComposition(rows: HominemSearchRow[], cur: string): Record<string, number> {
  const buckets: Record<string, number> = {};
  for (const name of FOOD_TAG_PRIORITY) buckets[name] = 0;
  for (const t of rows) {
    if (!isSpendRow(t) || t.currencyCode !== cur) continue;
    const names = tagNames(t);
    for (const name of FOOD_TAG_PRIORITY) {
      if (names.has(name)) {
        buckets[name] += Math.abs(t.amount);
        break;
      }
    }
  }
  const out: Record<string, number> = {};
  for (const name of FOOD_TAG_PRIORITY) out[name] = round2(buckets[name]);
  return out;
}

/** The hygiene-check cache diff, or the named absent/malformed note.
 * Archived messages verbatim; the notes are the port's deltas. */
function renderCacheDiff(month: string, tables: SpendTables): string[] {
  const cachePath = join(wealthDir(), `monthly_check_${month}_data.json`);
  if (!existsSync(cachePath)) {
    return [
      `- Hygiene-check cache (monthly_check_${month}_data.json): not found in the wealth dir — no cache diff this close.`,
    ];
  }
  let cache: {
    spending?: { categories?: { categoryName: string; currencyCode: string; spent: number }[] };
  };
  try {
    cache = JSON.parse(readFileSync(cachePath, 'utf8'));
  } catch (err) {
    return [
      `- Hygiene-check cache (monthly_check_${month}_data.json): malformed — skipped: ${String((err as Error).message).slice(0, 160)}`,
    ];
  }
  interface TotalsRow {
    cat: string;
    cur: string;
    spent: number;
  }
  const cached = new Map<string, TotalsRow>();
  for (const c of cache.spending?.categories ?? []) {
    if (EXCLUDED_CATEGORIES.has(c.categoryName)) continue;
    cached.set(`${c.categoryName}\u0000${c.currencyCode}`, {
      cat: c.categoryName,
      cur: c.currencyCode,
      spent: c.spent,
    });
  }
  const live = new Map<string, TotalsRow>();
  for (const [cur, cats] of Object.entries(tables)) {
    for (const [cat, e] of Object.entries(cats)) {
      live.set(`${cat}\u0000${cur}`, { cat, cur, spent: e.spent });
    }
  }
  const keys = [...new Set([...cached.keys(), ...live.keys()])].sort();
  const diffs: (TotalsRow & { a: number | null; b: number | null })[] = [];
  for (const key of keys) {
    const c = cached.get(key) ?? null;
    const l = live.get(key) ?? null;
    if (c === null || l === null || round2(c.spent) !== round2(l.spent)) {
      const base = c ?? l;
      // keys come from the union of both maps, so one side always
      // exists — TS can't see that, hence the guard.
      if (base === null) continue;
      diffs.push({
        cat: base.cat,
        cur: base.cur,
        spent: base.spent,
        a: c?.spent ?? null,
        b: l?.spent ?? null,
      });
    }
  }
  if (diffs.length === 0) {
    return [
      `- Hygiene-check cache (monthly_check_${month}_data.json): every category total matches the live pull exactly.`,
    ];
  }
  const out = [
    `- Hygiene-check cache (monthly_check_${month}_data.json): ${diffs.length} category total(s) differ from the live pull — recategorisation since that check, shown plainly, not smoothed over:`,
  ];
  for (const d of diffs) {
    const fmt = (v: number | null) => (v !== null ? money(d.cur, v) : 'absent');
    out.push(`  - ${d.cat} (${d.cur}): hygiene ${fmt(d.a)} → live ${fmt(d.b)}`);
  }
  return out;
}

// ---------------------------------------------------------------- sections

function render(
  month: string,
  today: string,
  defaultedMonth: boolean,
  d: MonthData,
  anchorsState: AnchorsState,
  toolWarnings: string[],
  hominemCalls: number,
): string {
  const tables = spendTables(d);
  const incomeRaw: Record<string, number> = {};
  for (const t of d.incomeRows) {
    const cur = t.currencyCode || 'UNKNOWN';
    incomeRaw[cur] = (incomeRaw[cur] ?? 0) + t.amount;
  }
  const income: Record<string, number> = {};
  for (const [k, v] of Object.entries(incomeRaw)) income[k] = round2(v);
  const currencies = [...new Set([...Object.keys(tables), ...Object.keys(income)])].sort(
    (a, b) => Number(a !== 'GBP') - Number(b !== 'GBP') || (a < b ? -1 : a > b ? 1 : 0),
  );
  const spendTotal: Record<string, number> = {};
  for (const [cur, cats] of Object.entries(tables)) {
    spendTotal[cur] = round2(Object.values(cats).reduce((s, e) => s + e.spent, 0));
  }
  const net: Record<string, number> = {};
  for (const cur of currencies) {
    net[cur] = round2((income[cur] ?? 0) - (spendTotal[cur] ?? 0));
  }

  const lines: string[] = [];
  lines.push(`# Monthly close — ${month}`);
  lines.push('');
  const defaultNote = defaultedMonth
    ? ` Month ${month} is the last complete month before ${today} — pin WEALTH_CLOSE_MONTH to close another.`
    : '';
  lines.push(
    `Produced by monthly_close.ts (WYA-230) on ${today}. Source: Hominem via the ` +
      `Hominem MCP client only (${hominemCalls} calls).${defaultNote} Definitions: ` +
      `income = Income category, posted and non-excluded; spend = ` +
      `finance_spending_by_category excluding Transfers and ` +
      `Adjustment. Currencies are never blended.`,
  );
  lines.push('');

  // ---- (a) headline
  lines.push('## Month summary');
  lines.push('');
  lines.push('| Currency | Income | Spend | Net | Savings rate |');
  lines.push('|---|---|---|---|---|');
  for (const cur of currencies) {
    const inc = income[cur] ?? 0;
    let rate: string;
    if (inc > 0 && net[cur] / inc >= -1) {
      rate = `${((net[cur] / inc) * 100).toFixed(1)}%`;
    } else if (inc > 0) {
      rate = 'n/m (see note)';
    } else {
      rate = 'n/m (no income)';
    }
    lines.push(
      `| ${cur} | ${money(cur, inc)} | ${money(cur, spendTotal[cur] ?? 0)} | ${money(cur, net[cur])} | ${rate} |`,
    );
  }
  lines.push('');
  for (const cur of currencies) {
    const inc = income[cur] ?? 0;
    if (inc > 0 && net[cur] / inc < -1) {
      lines.push(
        `Note (${cur}): savings rate not meaningful — ${cur} income recorded in Hominem this month is only ` +
          `${money(cur, inc)}; the ${cur} side runs largely through transfers, which are excluded by design. ` +
          `The net figure is the honest one.`,
      );
    }
  }
  lines.push('');

  // income sources
  if (d.incomeRows.length > 0) {
    lines.push('Income sources:');
    lines.push('');
    const bySrc = new Map<string, { name: string; cur: string; amt: number }>();
    for (const t of d.incomeRows) {
      const name = displayName(t);
      const cur = t.currencyCode || 'UNKNOWN';
      const key = `${name}\u0000${cur}`;
      const e = bySrc.get(key);
      if (e) e.amt += t.amount;
      else bySrc.set(key, { name, cur, amt: t.amount });
    }
    // Stable sort by -amount, the archived key.
    for (const s of [...bySrc.values()].sort((a, b) => b.amt - a.amt)) {
      lines.push(`- ${s.name} — ${money(s.cur, round2(s.amt))}`);
    }
    lines.push('');
  }

  // ---- (a) spend vs budget by category
  const budgets = new Map<
    string,
    { amount: number; currency: string; tags: Map<string, number> }
  >();
  for (const b of d.budgets.budgets) {
    // Status rows carry category rows (tagId null) AND tag rows; the
    // tag rows are the composition already nested as tagBudgets on
    // the category row, so only monthly category rows count here.
    if (b.cadence !== 'monthly' || b.tagId !== null) continue;
    budgets.set(b.categoryName, {
      amount: b.amountCents / 100,
      currency: b.currencyCode || 'GBP',
      tags: new Map(
        (b.tagBudgets ?? []).map((tb) => [tb.tagName, tb.amountCents / 100] as [string, number]),
      ),
    });
  }
  for (const cur of currencies) {
    const cats = tables[cur] ?? {};
    if (Object.keys(cats).length === 0) continue;
    lines.push(`### Spend by category — ${cur}`);
    lines.push('');
    lines.push('| Category | Spend | Transactions | Budget | Variance |');
    lines.push('|---|---|---|---|---|');
    for (const [cat, e] of Object.entries(cats).sort((a, b) => b[1].spent - a[1].spent)) {
      const b = budgets.get(cat);
      if (b && b.currency === cur) {
        const v = round2(e.spent - b.amount);
        const varS = `${v > 0 ? 'OVER by ' : 'under by '}${money(cur, Math.abs(v))}`;
        lines.push(
          `| ${cat} | ${money(cur, e.spent)} | ${e.count} | ${money(cur, b.amount)} | ${varS} |`,
        );
      } else {
        lines.push(`| ${cat} | ${money(cur, e.spent)} | ${e.count} | — (no stored budget) | — |`);
      }
    }
    const totalTx = Object.values(cats).reduce((s, e) => s + e.count, 0);
    lines.push(`| **Total** | **${money(cur, spendTotal[cur])}** | ${totalTx} | | |`);
    lines.push('');
    const foodB = budgets.get('Food');
    if (foodB && cur === foodB.currency && cats['Food'] !== undefined) {
      const comp = foodComposition(d.foodRows, cur);
      const verdict =
        cats['Food'].spent > foodB.amount
          ? 'BREACH — the parent Food budget is the hard line'
          : 'within budget';
      lines.push(
        `Food composition (disjoint, Coffee > Dining Out > Groceries priority; composition only — tag budgets never ` +
          `breach on their own). Food ${money(cur, cats['Food'].spent)} vs ${money(cur, foodB.amount)} budget: ${verdict}.`,
      );
      lines.push('');
      lines.push('| Food tag | Spend | Tag budget |');
      lines.push('|---|---|---|');
      for (const name of FOOD_TAG_PRIORITY) {
        const tb = foodB.tags.get(name);
        lines.push(
          `| ${name} | ${money(cur, comp[name] ?? 0)} | ${tb !== undefined ? money(cur, tb) : '—'} |`,
        );
      }
      lines.push('');
    }
  }

  // ---- cross-checks
  lines.push('## Cross-checks');
  lines.push('');
  for (const bd of d.monthlyStats.currencyBreakdown) {
    const cur = bd.currencyCode;
    lines.push(
      `- finance_monthly_stats (${cur}): income ${money(cur, bd.income)}, expenses ${money(cur, bd.expenses)}, ` +
        `net ${money(cur, bd.net)} — transfer-inclusive by design, so it differs from the headline ` +
        `(income ${money(cur, income[cur] ?? 0)}, spend ${money(cur, spendTotal[cur] ?? 0)}) by the transfers and ` +
        `non-Income credits it counts. Definitional, not an error.`,
    );
  }
  lines.push(...renderCacheDiff(month, tables));
  lines.push('');

  // ---- (b) net worth
  lines.push('## Net worth');
  lines.push('');
  lines.push(
    'Hominem holds no historical net-worth snapshots, so no month-boundary delta is computed — any figure claiming ' +
      "one would be invented. The position is stated as labelled anchors plus the month's net cash flow (a movement " +
      'figure, not a net-worth change: balances also move via transfers, FX and plugs).',
  );
  lines.push('');
  if (anchorsState.note) lines.push(anchorsState.note);
  for (const a of anchorsState.anchors) {
    // Archived truthiness port: {} and 0 are skipped, not rendered.
    if (a.totals && Object.keys(a.totals).length > 0) {
      const tot = Object.keys(a.totals)
        .sort()
        .map((cur) => `${cur} ${money(cur, a.totals![cur])}`)
        .join(', ');
      lines.push(`- ${a.date} — ${a.label}: ${tot}. Basis: ${a.basis}`);
    }
    if (a.blended_gbp) {
      lines.push(
        `- ${a.date} — ${a.label}: £${thousands(a.blended_gbp)} blended. Basis: ${a.basis}`,
      );
    }
  }
  const nwTot = d.netWorth.totals
    .map((t) => `${t.currencyCode} ${money(t.currencyCode, t.total)} (${t.accountCount} accounts)`)
    .join(', ');
  lines.push(
    `- Current at run time (${(d.netWorth.asOf || '?').slice(0, 10)}): ${nwTot}. Basis: finance_net_worth, ` +
      `per currency, unconverted.`,
  );
  const move = currencies.map((cur) => `${cur} ${money(cur, net[cur])}`).join(', ');
  lines.push(`- ${month} net cash flow (income − spend, plumbing excluded): ${move}.`);
  lines.push('');

  // ---- (c) tax flags
  lines.push('## Tax flags');
  lines.push('');
  const bizTot: Record<string, number> = {};
  for (const t of d.businessBreakdown.totalsByCurrency) bizTot[t.currencyCode] = t.totalSpending;
  const bizKeys = Object.keys(bizTot);
  if (bizKeys.length > 0) {
    const tot = bizKeys
      .sort()
      .map((cur) => money(cur, bizTot[cur]))
      .join(', ');
    lines.push(`Business-tagged spend: ${tot} across ${d.businessRows.length} transactions.`);
  } else {
    lines.push('Business-tagged spend: none.');
  }
  lines.push('');
  if (d.businessRows.length > 0) {
    lines.push('| Date | Merchant | Category | Amount |');
    lines.push('|---|---|---|---|');
    for (const t of [...d.businessRows].sort((a, b) =>
      a.postedOn < b.postedOn ? -1 : a.postedOn > b.postedOn ? 1 : 0,
    )) {
      const cur = t.currencyCode || 'UNKNOWN';
      // (archived f-string rendered a missing category as "None")
      lines.push(
        `| ${t.postedOn} | ${displayName(t)} | ${t.categoryName ?? 'None'} | ${money(cur, Math.abs(t.amount))} |`,
      );
    }
    lines.push('');
  }
  for (const cur of Object.keys(tables)) {
    const cats = tables[cur];
    if (cats['Taxes & Fees'] !== undefined) {
      lines.push(`Taxes & Fees category: ${money(cur, cats['Taxes & Fees'].spent)}.`);
    }
  }
  if (d.incomeRows.length > 0) {
    const srcs = [...new Set(d.incomeRows.map((t) => displayName(t)))].sort();
    lines.push(
      `Income sources this month: ${srcs.join(', ')}. Anything beyond employment and interest would be named here as ` +
        `Self-Assessment-relevant; the Business-tagged spend above is the accumulating SA record.`,
    );
  }
  lines.push('');
  for (const note of anchorsState.taxStatus) lines.push(`- ${note}`);
  lines.push('');

  // ---- (d) uncategorized residue
  lines.push('## Uncategorized residue');
  lines.push('');
  const residue = d.uncatRows.filter(isSpendRow);
  const excludedN = d.uncatRows.filter((t) => t.excluded).length;
  const resTot: Record<string, number> = {};
  for (const t of residue) {
    const cur = t.currencyCode || 'UNKNOWN';
    resTot[cur] = (resTot[cur] ?? 0) + Math.abs(t.amount);
  }
  if (residue.length > 0) {
    const tot = Object.keys(resTot)
      .sort()
      .map((cur) => money(cur, round2(resTot[cur])))
      .join(', ');
    lines.push(`${residue.length} posted spend rows still Uncategorized at close: ${tot}.`);
    lines.push('');
    lines.push('| Date | Merchant | Amount |');
    lines.push('|---|---|---|');
    for (const t of [...residue].sort((a, b) =>
      a.postedOn < b.postedOn ? -1 : a.postedOn > b.postedOn ? 1 : 0,
    )) {
      const cur = t.currencyCode || 'UNKNOWN';
      lines.push(`| ${t.postedOn} | ${displayName(t)} | ${money(cur, Math.abs(t.amount))} |`);
    }
    lines.push('');
  } else {
    lines.push('No posted spend rows left Uncategorized — residue is zero.');
    lines.push('');
  }
  if (excludedN > 0) {
    lines.push(
      `(${excludedN} excluded rows also sit in Uncategorized — balance plugs and account notes; excluded from ` +
        `analytics, not residue.)`,
    );
    lines.push('');
  }
  if (toolWarnings.length > 0) {
    lines.push('## Tool warnings');
    lines.push('');
    for (const w of toolWarnings) lines.push(`- ${w}`);
    lines.push('');
  }
  // Every render section closes with a blank line element, so the join
  // ends the doc with exactly one newline. The close file keeps it
  // (POSIX-tidy); stdout writes md as-is, never doubling it.
  return lines.join('\n');
}

// -------------------------------------------------------------------- main

async function runClose(
  dbPath: string | undefined,
  month: string,
  today: string,
  defaultedMonth: boolean,
): Promise<{ md: string; calls: number; message: string }> {
  const hominem = new HominemMcp({ dbPath });
  let hominemCalls = 0;
  const origCall = hominem.call.bind(hominem);
  hominem.call = ((tool: string, args: Record<string, unknown>) => {
    hominemCalls += 1;
    return origCall(tool, args);
  }) as typeof hominem.call;

  const toolWarnings: string[] = [];
  const warn = (tool: string, w: string) => toolWarnings.push(`${tool}: ${w}`);
  const d = await pullMonth(hominem, month, warn);
  const anchorsState = readAnchors(wealthDir());
  const md = render(month, today, defaultedMonth, d, anchorsState, toolWarnings, hominemCalls);
  const residueN = d.uncatRows.filter(isSpendRow).length;
  const message =
    `month ${month}: ${hominemCalls} hominem calls, ${residueN} residue rows, ` +
    `${toolWarnings.length} tool warnings`;
  return { md, calls: hominemCalls, message };
}

export async function main(): Promise<number> {
  applyEnvDefaults();
  const today = todayIso();
  const pinned = process.env.WEALTH_CLOSE_MONTH;
  const month = pinned ?? isoAddMonths(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
  if (!MONTH_RE.test(month)) {
    // Usage error before any audit row (the archived sys.exit, on the
    // Hominem exit-2 precedent; the regex also rejects what the archived
    // len/dash check let through to a later crash).
    process.stderr.write('month must be YYYY-MM\n');
    return 2;
  }
  const dbPath = process.env.HOMINEM_AGENT_DB; // undefined = the default audit db
  const runId = logRun('wealth-close', {
    status: 'invoked',
    context: { today, dir: wealthDir(), month, out: process.env.WEALTH_CLOSE_OUT ?? null },
    path: dbPath,
  });
  try {
    const { md, calls, message } = await runClose(dbPath, month, today, pinned === undefined);
    finishRun(runId, { status: 'ok', exitCode: 0, message, path: dbPath });
    const outPath = process.env.WEALTH_CLOSE_OUT;
    if (outPath) {
      writeFileSync(outPath, md);
      process.stdout.write(`wrote ${outPath} (${calls} calls)\n`);
    } else {
      // md already ends with exactly one newline (every render section
      // closes with a blank element) — don't double it on stdout.
      process.stdout.write(md);
    }
    return 0;
  } catch (err) {
    // Any tool failure fails the whole close (the archived sh()
    // raised; a statement with a hole in it is worse than none).
    const message = `${(err as Error).name ?? 'Error'}: ${(err as Error).message ?? String(err)}`;
    finishRun(runId, {
      status: 'failed',
      exitCode: 1,
      message: message.slice(0, 500),
      path: dbPath,
    });
    process.stdout.write(JSON.stringify({ ok: false, error: message }, null, 1) + '\n');
    return 1;
  }
}
