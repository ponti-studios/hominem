#!/usr/bin/env node
/**
 * Daily transaction sync: Starling API + Plaid -> Hominem
 * (finance_transactions_import) — the ported crown jewel, mocked-first
 * 2026-11-22. Successor lineage: daily_txn_sync.py (sheet) →
 * daily_txn_sync_hominem.py (Hominem, since 2026-10-13) → here.
 *
 * Charles's ruling, 2026-11-22: this repo holds no personal financial
 * data. Account routing and the categorization doctrine resolve from
 * Hominem at runtime — finance_accounts for the registry (provider
 * identity + mask), finance_doctrine_get for the ingest doctrine —
 * both shipped on hominem's feature/finance-sync-doctrine.
 *
 * The contract, unchanged from the archived sync:
 *   - Windows anchor on the watermark state file (hominem_sync_state.json
 *     under HOMINEM_AGENT_WEALTH_DIR, default ~/.hominem/wealth): since = max - 1
 *     day per source, so the overlap re-sends a settled day and the
 *     server's natural-key upsert makes that idempotent.
 *   - Intra-run dedupe on the natural key (postedOn, account label,
 *     description, cents, currency) before the import.
 *   - Rows that route to no Hominem account are held out and banked in
 *     pending_unmapped.json with the reason — never guessed ("never
 *     guess a mapping", accounts.py).
 *   - Pending Plaid rows are skipped: Hominem rejects them loudly
 *     (pending_row).
 *   - Best-effort transfer linking over the window ±3 days: a pair links
 *     only when the counterpart is the unique opposite-amount candidate
 *     in a different account; the FULL row is resent because upsert
 *     REPLACES (B15, verified 2026-10-15 — omitted fields reset). Never
 *     fatal.
 *
 * Deliberate deltas from the archive (recorded 2026-11-22):
 *   - No 2026-10-11 backfill maxima on a missing state file — that was
 *     hatch-machine state. A fresh start uses the safe 7-day default
 *     window; upserts make the re-send free.
 *   - Dedupe keys on integer cents, not 2dp floats (the server's actual
 *     natural key is amountCents; float equality was the archived
 *     version's only weak spot).
 *   - The account registry and the merchant rules are not code: they
 *     live in Hominem. The archived exact-merchant layer (425 rules in
 *     merchant_category_rules.json) was never salvaged — rows it would
 *     have matched land Uncategorized and queue for a ruling.
 *   - Import chunks at 1000 rows (the schema's per-call max).
 *   - Missing Plaid credentials or an access token skip the Plaid pull
 *     with a named warning. A configured but failing Plaid API call
 *     fails the run loudly.
 *
 * Env (law 4 — a missing variable fails by name):
 *   STARLING_API_TOKEN   Starling bearer token (machine .env)
 *   HOMINEM_MCP_URL      e.g. http://localhost:4040/api/mcp
 *   HOMINEM_MCP_TOKEN    personal hmt_ token
 *   PLAID_CLIENT_ID      Plaid Dashboard client identifier
 *   PLAID_SECRET         Plaid environment secret
 *   PLAID_ACCESS_TOKEN   Linked Item access token
 *   PLAID_ENV            sandbox|development|production
 *   HOMINEM_AGENT_WEALTH_DIR     state dir (default ~/.hominem/wealth)
 *   WEALTH_SYNC_TODAY    pin the run date (tests / a pinned re-run)
 *
 * Prints JSON: {ok, added, updated, by_source, held, new_labels,
 *              unmapped, linked, windows, warnings, run_id}
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { finishRun, logRun } from '../../log/agent_log.ts';
import { categorize, classifyRow, tagsFor, EMPTY_DOCTRINE } from './categorize.ts';
import { applyEnvDefaults, envOr } from './env.ts';
import { HominemMcp, HominemMcpError, type HominemTxn, type ImportTotals } from './hominem.ts';
import { plaidPull, plaidSetupStatus, type PlaidPullResult } from './plaid.ts';
import { starlingPull, type StarlingItem } from './starling.ts';
import {
  isoDaysBetween,
  isoMinusDays,
  naturalKey,
  toCents,
  type HominemAccount,
  type SyncDoctrine,
  type SyncRow,
} from './types.ts';

const SOURCE_MAP: Record<string, string> = {
  'Starling API': 'starling',
  Plaid: 'plaid',
};

/** The run date. Machine-local like the archived sync; pinnable for tests. */
function todayIso(): string {
  return process.env.WEALTH_SYNC_TODAY ?? new Date().toLocaleDateString('en-CA');
}

interface SyncState {
  starling_max?: string;
  plaid_max?: string;
}

function wealthDir(): string {
  return envOr('HOMINEM_AGENT_WEALTH_DIR', join(homedir(), '.hominem', 'wealth'));
}

function loadState(dir: string, warnings: string[]): SyncState {
  const path = join(dir, 'hominem_sync_state.json');
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as SyncState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    warnings.push(`sync state unreadable (${(err as Error).message}) — treating as fresh`);
    return {};
  }
}

/** since = max - 1 day (overlap is safe: server upsert). Fresh: 7 days. */
function sinceFrom(maxDate: string | undefined, today: string): string {
  if (!maxDate) return isoMinusDays(today, 7);
  return isoMinusDays(maxDate, 1);
}

/**
 * Starling items -> sync rows, faithful to the archived starling_pull:
 * SETTLED only; every row carries its bank-side UID as the route
 * identity (unknown UIDs keep a provisional label and are held out
 * downstream, never guessed); and the 2026-10-31 ruling carried
 * verbatim below.
 */
export function starlingItemsToRows(items: StarlingItem[], doctrine: SyncDoctrine): SyncRow[] {
  const out: SyncRow[] = [];
  for (const t of items) {
    if (t.status !== 'SETTLED') continue;
    const uid = t.accountUid ?? '';
    // Provisional hold-out label — routeRow replaces it with the
    // Hominem account's display name when the UID routes.
    const label = uid ? `Starling ${uid.slice(0, 8)}` : 'Starling (no account uid)';
    const cents = toCents(t.amount);
    let merchant = t.merchant;
    let cat: string;
    if (t.src === 'INTERNAL_TRANSFER') {
      // A move between an account and one of its Spaces (Starling savings
      // goals), or between Spaces — Charlie's ruling, 2026-10-31: always a
      // Transfer, never spend. The main-feed leg already names the Space
      // (cp='Bills'); name the Space leg after the Space too, so both
      // legs read identically.
      cat = 'Transfers';
      if (t.space) merchant = t.space;
    } else {
      // Space-feed rows that are not internal moves are real spend from
      // that Space (e.g. a bill paid out of the Bills Space) — they
      // classify by merchant like any main-feed row.
      cat = classifyRow(merchant, cents, label, doctrine) || categorize(merchant, cents, doctrine);
    }
    out.push({
      date: t.date,
      label,
      route: uid ? { provider: 'starling', providerAccountId: uid } : undefined,
      merchant,
      amount: t.amount,
      currency: t.currency,
      tags: tagsFor(merchant, cat, doctrine),
      source: 'Starling API',
      orderNumber: '',
      category: cat,
    });
  }
  return out;
}

/**
 * Route one row against Hominem's account registry. Starling rows by
 * (provider, providerAccountId); Plaid rows by the feed mask, which
 * Hominem stores as the account's accountNumber. Zero matches or an
 * ambiguous mask both hold out with a named reason — never guessed.
 */
export function routeRow(
  row: SyncRow,
  accounts: HominemAccount[],
): { ok: boolean; account?: HominemAccount; reason?: string } {
  const r = row.route;
  if (!r) return { ok: false, reason: 'row carries no routing identity' };
  if (r.provider === 'starling') {
    const hits = accounts.filter(
      (a) => a.provider === 'starling' && a.providerAccountId === r.providerAccountId,
    );
    if (hits.length === 1) return { ok: true, account: hits[0] };
    return {
      ok: false,
      reason:
        hits.length === 0
          ? `no hominem account with (provider starling, provider_account_id ${r.providerAccountId})`
          : `ambiguous starling identity ${r.providerAccountId}: ${hits.length} accounts match`,
    };
  }
  const hits = accounts.filter((a) => a.accountNumber === r.mask);
  if (hits.length === 1) return { ok: true, account: hits[0] };
  return {
    ok: false,
    reason:
      hits.length === 0
        ? `no hominem account with account_number ${r.mask}`
        : `ambiguous mask ${r.mask}: ${hits.length} accounts match`,
  };
}

/** One row -> the Hominem write-model DTO (the archived to_txn). */
function toTxn(row: SyncRow): HominemTxn {
  if (!row.accountId) {
    throw new Error(
      `unrouted row reached the import: ${row.label} (${row.holdoutReason ?? 'no reason'})`,
    );
  }
  const txn: HominemTxn = {
    postedOn: row.date,
    account: row.accountId,
    description: row.merchant || '(no description)',
    amountCents: toCents(row.amount),
    currencyCode: row.currency || 'USD',
    source: SOURCE_MAP[row.source] ?? 'manual',
  };
  if (row.category) txn.category = row.category;
  if (row.tags.length > 0) txn.tags = [...row.tags];
  return txn;
}

interface SearchRow {
  id: string;
  accountId: string;
  accountName: string;
  amount: number; // read model: decimal, not cents
  currencyCode: string;
  postedOn: string;
  description: string;
  categoryName: string;
  source: string;
  transactionType: string;
  excluded?: boolean;
  recurring?: boolean;
  pending?: boolean;
  counterpartId?: string | null;
  tags?: string[];
  orderNumber?: string | null;
  notes?: string | null;
}

/**
 * Best-effort counterpart linking over the sync window (+/-3 days).
 * Pages the window once, groups unlinked Transfers rows by (cents,
 * currency), and links a pair only when it is the unique opposite-amount
 * candidate in a different account within 3 days (the server mirrors the
 * link). FULL row resend is mandatory: the upsert REPLACES the row.
 * Never fatal — returns human-readable notes.
 */
async function linkTransfers(
  windowSince: string,
  today: string,
  hominem: HominemMcp,
): Promise<string[]> {
  const notes: string[] = [];
  try {
    const d0 = isoMinusDays(windowSince, 3);
    const txns: SearchRow[] = [];
    let offset = 0;
    for (;;) {
      const page = await hominem.call<{ transactions: SearchRow[] }>('finance_transaction_search', {
        from: d0,
        to: today,
        limit: 50,
        offset,
      });
      const batch = page.transactions ?? [];
      if (batch.length === 0) break;
      txns.push(...batch);
      offset += batch.length;
      if (batch.length < 50) break;
    }
    const pool = txns
      .filter((t) => t.categoryName === 'Transfers' && !t.counterpartId)
      .map((t) => ({ ...t, amountCents: Math.round(t.amount * 100) }));
    const byKey = new Map<string, typeof pool>();
    for (const t of pool) {
      const key = JSON.stringify([t.amountCents, t.currencyCode]);
      const arr = byKey.get(key) ?? [];
      arr.push(t);
      byKey.set(key, arr);
    }
    const linkedIds = new Set<string>();
    for (const t of pool) {
      if (linkedIds.has(t.id)) continue;
      const opposite = byKey.get(JSON.stringify([-t.amountCents, t.currencyCode])) ?? [];
      const cands = opposite.filter(
        (o) =>
          o.accountId !== t.accountId &&
          !linkedIds.has(o.id) &&
          Math.abs(isoDaysBetween(o.postedOn, t.postedOn)) <= 3,
      );
      if (cands.length !== 1) continue;
      const o = cands[0];
      // Full row, every field (B15): omitted fields reset on upsert.
      const up: Record<string, unknown> = {
        postedOn: t.postedOn,
        account: t.accountName,
        description: t.description,
        amountCents: t.amountCents,
        currencyCode: t.currencyCode,
        source: t.source,
        category: t.categoryName,
        transactionType: t.transactionType,
        excluded: Boolean(t.excluded),
        recurring: Boolean(t.recurring),
        pending: Boolean(t.pending),
        counterpartId: o.id,
      };
      if (t.tags && t.tags.length > 0) up.tags = t.tags;
      if (t.orderNumber) up.orderNumber = t.orderNumber;
      let rowNotes = t.notes;
      if (rowNotes && t.orderNumber) {
        // The read model appends "\nOrder #: X" to notes; don't bake it in.
        rowNotes =
          rowNotes.replace(
            new RegExp(`\\n?Order #: ${t.orderNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
            '',
          ) || null;
      }
      if (rowNotes) up.notes = rowNotes;
      const res = await hominem.call<{ id: string | null }>('finance_transaction_upsert', up);
      if (res.id === t.id) {
        linkedIds.add(t.id);
        linkedIds.add(o.id);
        notes.push(
          `linked ${t.postedOn} ${t.description.slice(0, 26)} ${t.amountCents} (${t.accountName}) <-> ` +
            `${o.description.slice(0, 26)} (${o.accountName})`,
        );
      }
    }
  } catch (err) {
    if (err instanceof HominemMcpError) {
      notes.push(`link pass skipped: ${err.message}`);
    } else {
      notes.push(`link pass skipped: ${(err as Error).name}: ${(err as Error).message}`);
    }
  }
  return notes;
}

interface SyncEnvelope {
  ok: boolean;
  added: number;
  updated: number;
  by_source: Record<string, number>;
  held: SyncRow[];
  new_labels: string[];
  unmapped: { date: string; account: string; description: string; amount: number }[];
  linked: string[];
  windows: { starling_since: string; plaid_since: string; until: string };
  warnings: string[];
  run_id: number;
}

async function runSync(dbPath: string | undefined, runId: number): Promise<SyncEnvelope> {
  const today = todayIso();
  const dir = wealthDir();
  mkdirSync(dir, { recursive: true });

  const warnings: string[] = [];
  const state = loadState(dir, warnings);
  const sSince = sinceFrom(state.starling_max, today);
  const pSince = sinceFrom(state.plaid_max, today);

  // The registry and the doctrine resolve from Hominem at runtime —
  // this repo holds no personal financial data (ruling 2026-11-22).
  const hominem = new HominemMcp({ dbPath });
  const accountsRes = await hominem.listFinanceAccounts();
  const accounts: HominemAccount[] = accountsRes.accounts;
  if (accounts.length === 0) {
    warnings.push(
      'finance_accounts returned no accounts — every row will be held out; ' +
        'create them with finance_account_create (identity: provider + providerAccountId, or the mask)',
    );
  }
  if (accountsRes.totalCount > accounts.length) {
    warnings.push(
      `finance_accounts hit its ${accounts.length}-account cap but totalCount is ${accountsRes.totalCount} — ` +
        'rows on unseen accounts will be held out',
    );
  }
  const doctrineState = await hominem.getFinanceDoctrine();
  const doctrine: SyncDoctrine = doctrineState.doctrine ?? EMPTY_DOCTRINE;
  if (!doctrineState.doctrine) {
    warnings.push(
      'finance_doctrine_get returned no doctrine — every merchant lands Uncategorized and ' +
        'queues for a ruling; import one with finance_doctrine_import',
    );
  }

  const starling = await starlingPull(sSince, today, { dbPath });
  warnings.push(...starling.notes.map((n) => `starling: ${n}`));

  // Plaid is a sourced-on-demand native REST leg. Missing setup skips
  // it with a named warning; configured API failures fail the routine.
  let plaid: PlaidPullResult = { rows: [] };
  const plaidStatus = plaidSetupStatus();
  if (plaidStatus.accessTokenConfigured) {
    plaid = await plaidPull(pSince, today, { dbPath }, doctrine);
  } else {
    warnings.push(
      'plaid source skipped: PLAID_ACCESS_TOKEN is not set — run hominem plaid auth to link an account',
    );
  }

  const sRows = starlingItemsToRows(starling.items, doctrine);
  const allRows: SyncRow[] = [...sRows, ...plaid.rows];

  // Route by identity: a routed row takes the Hominem account's display
  // label + UUID; an unroutable row keeps its provisional hold-out label.
  for (const row of allRows) {
    const r = routeRow(row, accounts);
    if (r.ok && r.account) {
      row.label = r.account.name;
      row.accountId = r.account.id;
    } else {
      row.holdoutReason = r.reason;
    }
  }

  // Intra-run dedupe on the natural key (the server upsert handles the rest).
  const seen = new Set<string>();
  const uniq: SyncRow[] = [];
  for (const row of allRows) {
    const key = naturalKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(row);
  }

  const send: SyncRow[] = [];
  const held: SyncRow[] = [];
  for (const row of uniq) (row.accountId ? send : held).push(row);

  let result: ImportTotals = {
    received: 0,
    upserted: 0,
    created: 0,
    updated: 0,
    rejected: [],
    accountsAutoProvisioned: [],
  };
  let linkNotes: string[] = [];
  if (send.length > 0) {
    result = await hominem.importTransactions(send.map(toTxn));
    if (result.rejected.length > 0) {
      // Rejected rows are never silently dropped — the archived contract.
      throw new Error(`hominem rejected rows: ${JSON.stringify(result.rejected).slice(0, 400)}`);
    }
    linkNotes = await linkTransfers(sSince < pSince ? sSince : pSince, today, hominem);
  }

  // Fresh rows that landed with no category queue for a ruling.
  const fresh = isoMinusDays(today, 2);
  const unmapped = send
    .filter((r) => !r.category && r.date >= fresh)
    .map((r) => ({ date: r.date, account: r.label, description: r.merchant, amount: r.amount }));

  // Unrouted Plaid labels, in pull order — the accounts to map in Hominem.
  const new_labels: string[] = [];
  for (const row of held) {
    if (row.source === 'Plaid' && !new_labels.includes(row.label)) new_labels.push(row.label);
  }

  // Bank held rows in pending_unmapped.json — keyed, additive, never guessed.
  if (held.length > 0) {
    const pendingPath = join(dir, 'pending_unmapped.json');
    let banked: unknown[] = [];
    try {
      banked = JSON.parse(readFileSync(pendingPath, 'utf8')) as unknown[];
      if (!Array.isArray(banked)) banked = [];
    } catch {
      banked = [];
    }
    const known = new Set(banked.map((r) => naturalKey(r as SyncRow)));
    for (const row of held) {
      if (!known.has(naturalKey(row))) banked.push(row);
    }
    writeFileSync(pendingPath, JSON.stringify(banked, null, 1));
  }

  // Watermarks advance over everything pulled (held rows included): held
  // rows are already banked, so re-pulling them forever serves nothing.
  const next: SyncState = { ...state };
  for (const [rows, key] of [
    [sRows, 'starling_max'],
    [plaid.rows, 'plaid_max'],
  ] as const) {
    if (rows.length > 0) {
      const max = rows.reduce((m, r) => (r.date > m ? r.date : m), '');
      next[key] = (next[key] ?? '') > max ? next[key] : max;
    }
  }
  writeFileSync(join(dir, 'hominem_sync_state.json'), JSON.stringify(next, null, 1));

  const by_source: Record<string, number> = {};
  for (const r of send) by_source[r.source] = (by_source[r.source] ?? 0) + 1;

  return {
    ok: true,
    added: result.created,
    updated: result.updated,
    by_source,
    held,
    new_labels,
    unmapped,
    linked: linkNotes,
    windows: { starling_since: sSince, plaid_since: pSince, until: today },
    warnings,
    run_id: runId,
  };
}

export async function main(): Promise<number> {
  applyEnvDefaults();
  const dbPath = process.env.HOMINEM_AGENT_DB; // undefined = the default audit db
  const runId = logRun('wealth-sync', {
    status: 'invoked',
    context: { today: todayIso(), dir: wealthDir() },
    path: dbPath,
  });
  try {
    const envelope = await runSync(dbPath, runId);
    finishRun(runId, {
      status: 'ok',
      exitCode: 0,
      message: `added ${envelope.added}, updated ${envelope.updated}, held ${envelope.held.length}, linked ${envelope.linked.length}`,
      path: dbPath,
    });
    process.stdout.write(JSON.stringify(envelope, null, 1) + '\n');
    return 0;
  } catch (err) {
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
