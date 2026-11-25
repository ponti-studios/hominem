#!/usr/bin/env node
/**
 * Layer 1 — ledger integrity checks (WYA-227), ported 2026-11-22 from
 * archive systems-live/wealth-manager/layer1_integrity_check.py. Runs
 * AFTER the daily sync. The sync pipe stays untouched; this routine
 * only reads. It compares Hominem (system of record) against the feeds
 * and prints one JSON object:
 *
 *   {"ok": true, "date": "...", "flags": [...], "info": {...}, "run_id": n}
 *
 * flags = exceptions worth surfacing to Charles (an empty list is a
 * quiet day). info = diagnostics for the log. Each flag carries a
 * severity: "flag" (look at this) or "info" (a check was skipped and
 * why — never silence).
 *
 * Checks:
 *   1. feed_health — sync watermarks present and not stale (>4 days).
 *   2. balance_drift — per Plaid account, Hominem's ledger sum vs the
 *      feed's current balance, with the gap window (feed transactions
 *      posted after the ledger's max date) explaining timing lag.
 *      Residual beyond $1.00 is flagged. (Lesson of the 2026-10-28 Amex
 *      sign fix: anchored balances drift silently when history is
 *      edited; only a ledger-vs-feed comparison catches it.)
 *   3. starling_reconciliation — SETTLED Starling feed transactions vs
 *      ledger rows sourced from Starling over the watermark window
 *      (Starling's pull exposes no balance endpoint, so fidelity is
 *      checked on the window instead of the balance).
 *   4. anchor_freshness — manual-refresh accounts (no feed): age of
 *      the balanceAsOf anchor from finance_net_worth vs per-account
 *      threshold.
 *   5. cancellation_watch — post-cancellation charges and confirmation
 *      deadlines from cancellation_watches.json.
 *   6. payment_verification — Plaid liabilities: for each card, sum
 *      ledger payments in [statement issue date, due date + 3d grace]
 *      (the window anchors on the ISSUE date and sums ALL payments —
 *      the two rules bought with the 2026-10-28 Amex false flag). Hard
 *      flag only once past due + grace and still short.
 *
 * Deliberate deltas from the archive (recorded 2026-11-22):
 *   - The archived script imported accounts.py (personal label maps,
 *     hardcoded) and hatch paths. This port resolves the registry from
 *     Hominem at runtime (finance_accounts: masks are accountNumber,
 *     Starling UIDs are providerAccountId) — Charles's ruling, this
 *     repo holds no personal financial data.
 *   - MANUAL_ANCHORS thresholds (personal: which accounts are
 *     manual-refresh, how stale is too stale) are a machine-local
 *     input file, manual_anchors.json under HOMINEM_AGENT_WEALTH_DIR —
 *     {"Account Display Name": maxAgeDays}. Absent file = named info
 *     note, check skipped, never guessed.
 *   - Starling reconciliation covers EVERY open Starling account by
 *     identity (the archive checked the one account its label map
 *     knew). Space legs ride the owning account on both sides.
 *   - Missing Plaid access setup: PLAID_ACCESS_TOKEN unset skips the
 *     two Plaid-fed checks with named info notes (same policy as the
 *     sync's Plaid leg). A set-but-failing CLI is fatal inside its
 *     check and surfaces as a flag, never silence.
 *   - The cancellation-charge sweep keeps the archived wide net
 *     (from 2026-10-21, the sweep origin) — a read bound, not data.
 *   - "normalization" in a description excludes a row from statement
 *     payment sums, carried verbatim: it is the ledger's balance-plug
 *     token (2026-10-28 Amex resolution), not a guess.
 *
 * Env (law 4): HOMINEM_MCP_URL + HOMINEM_MCP_TOKEN (the backbone —
 * missing fails the run by name), STARLING_API_TOKEN / PLAID_CLI
 * (optional legs — missing skips their checks with named notes),
 * HOMINEM_AGENT_WEALTH_DIR (default ~/.hominem/wealth), WEALTH_SYNC_TODAY (pin
 * the run date, tests / pinned re-runs).
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { finishRun, logRun } from '../../log/agent_log.ts';
import { applyEnvDefaults, envOr } from './env.ts';
import {
  HominemMcp,
  type AccountSummaryEntry,
  type HominemSearchRow,
  type NetWorthAccount,
} from './hominem.ts';
import { plaidAccounts, plaidLiabilities, plaidTransactionsWindow } from './plaid.ts';
import { starlingPull } from './starling.ts';
import { isoDaysBetween, isoMinusDays, isoPlusDays, round2, type HominemAccount } from './types.ts';

const DRIFT_TOLERANCE = 1.0;
const STARLING_TOLERANCE = 0.01;
/** The cancellation-charge sweep origin — the archived wide net, kept. */
const SWEEP_FROM = '2026-10-21';

interface Flag {
  check: string;
  account: string | null;
  detail: string;
  severity: 'flag' | 'info';
}

class Ctx {
  flags: Flag[] = [];
  info: Record<string, unknown> = {};

  note(
    check: string,
    account: string | null,
    detail: string,
    severity: 'flag' | 'info' = 'flag',
  ): void {
    this.flags.push({ check, account, detail, severity });
  }
}

function todayIso(): string {
  return process.env.WEALTH_SYNC_TODAY ?? new Date().toLocaleDateString('en-CA');
}

function wealthDir(): string {
  return envOr('HOMINEM_AGENT_WEALTH_DIR', join(homedir(), '.hominem', 'wealth'));
}

/** Machine-local input file, optional by design — null when absent/unreadable. */
function readOptionalJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

interface SyncStateFile {
  starling_max?: string;
  plaid_max?: string;
}

/**
 * finance_transaction_search with the archived recursive date-window
 * split: when a window holds more matches than one page (limit 50),
 * split at the midpoint and read both halves — bounded, no offset
 * guessing past the cap.
 */
async function searchWindow(
  hominem: HominemMcp,
  accountId: string,
  from: string,
  to: string,
): Promise<HominemSearchRow[]> {
  const res = await hominem.searchTransactions({ accountId, from, to, limit: 50 });
  if (res.filteredCount > res.transactions.length && from < to) {
    const mid = isoPlusDays(from, Math.floor(isoDaysBetween(from, to) / 2));
    const left = await searchWindow(hominem, accountId, from, mid);
    const right = await searchWindow(hominem, accountId, isoPlusDays(mid, 1), to);
    return [...left, ...right];
  }
  return res.transactions;
}

// ---------------------------------------------------------------- checks

function checkFeedHealth(ctx: Ctx, dir: string, today: string): SyncStateFile {
  const state = readOptionalJson<SyncStateFile>(join(dir, 'hominem_sync_state.json'));
  if (!state) {
    ctx.note(
      'feed_health',
      null,
      'cannot read sync state file hominem_sync_state.json — has the sync ever run?',
    );
    return {};
  }
  ctx.info.watermarks = state;
  for (const key of ['starling_max', 'plaid_max'] as const) {
    const wm = state[key];
    if (!wm) {
      ctx.note('feed_health', key, 'watermark missing');
      continue;
    }
    const age = isoDaysBetween(wm, today);
    if (age > 4) {
      ctx.note(
        'feed_health',
        key,
        `watermark ${key} is ${age} days old (${wm}); the sync or the feed may be stalled`,
      );
    }
  }
  return state;
}

interface DriftResult {
  hominemId: string;
  name: string;
  feedSigned: number;
  ledgerSum: number;
  maxPosted: string | null;
  currency: string;
  residual?: number;
}

async function checkPlaidDrift(
  ctx: Ctx,
  accounts: HominemAccount[],
  summaries: Map<string, AccountSummaryEntry>,
  today: string,
  dbPath: string | undefined,
): Promise<void> {
  if (!process.env.PLAID_ACCESS_TOKEN) {
    ctx.note(
      'balance_drift',
      null,
      'skipped: PLAID_ACCESS_TOKEN is not set — run hominem plaid auth to enable the drift check',
      'info',
    );
    return;
  }
  const body = await plaidAccounts({ dbPath });
  const feedAccounts = body.accounts ?? [];
  ctx.info.plaid_accounts = feedAccounts.length;
  const results = new Map<string, DriftResult>();
  for (const a of feedAccounts) {
    const mask = a.mask ?? '';
    // Route by identity: the feed mask is the Hominem account's
    // accountNumber. Unroutable feed accounts aren't ours to check —
    // the sync holds their rows out too.
    const hits = accounts.filter((acc) => acc.accountNumber === mask);
    if (hits.length !== 1) continue;
    const summ = summaries.get(hits[0].id);
    if (!summ) continue;
    const bal = a.balances?.current;
    if (bal === null || bal === undefined) continue;
    const cur = a.balances?.iso_currency_code ?? 'USD';
    // Ledger convention: a card's owed balance is negative.
    const feedSigned = a.type === 'depository' ? bal : -bal;
    const ledgerSum = summ.totals.find((t) => t.currencyCode === cur)?.sum;
    if (ledgerSum === undefined) continue;
    results.set(a.account_id ?? '', {
      hominemId: hits[0].id,
      name: summ.accountName,
      feedSigned,
      ledgerSum,
      maxPosted: summ.maxPostedOn,
      currency: cur,
    });
  }
  // Explain timing lag with feed transactions after each ledger's max
  // date: feed balance (today) minus the movement after maxPostedOn is
  // the balance the ledger should show. No max dates = no gap window.
  const maxDates = [...results.values()].map((r) => r.maxPosted).filter((d): d is string => !!d);
  if (results.size > 0 && maxDates.length > 0) {
    const start = maxDates.reduce((m, d) => (d < m ? d : m));
    const tbody = await plaidTransactionsWindow(start, today, { dbPath });
    const gap = new Map<string, { date: string; amount: number }[]>();
    for (const t of tbody.transactions ?? []) {
      if (t.pending) continue;
      const arr = gap.get(t.account_id ?? '') ?? [];
      arr.push({ date: t.date ?? '', amount: t.amount ?? 0 });
      gap.set(t.account_id ?? '', arr);
    }
    for (const [pid, r] of results) {
      if (!r.maxPosted) continue;
      // Plaid amount: positive = outflow; ledger movement is its negation.
      const gapSum = round2(
        (gap.get(pid) ?? []).reduce((s, t) => (t.date > r.maxPosted! ? s - t.amount : s), 0),
      );
      const expected = round2(r.feedSigned - gapSum);
      const residual = round2(r.ledgerSum - expected);
      r.residual = residual;
      if (Math.abs(residual) > DRIFT_TOLERANCE) {
        ctx.note(
          'balance_drift',
          r.name,
          `ledger sum ${r.ledgerSum.toFixed(2)} ${r.currency} vs feed-implied ${expected.toFixed(2)} ` +
            `(feed balance ${r.feedSigned.toFixed(2)}, gap window ${gapSum >= 0 ? '+' : ''}${gapSum.toFixed(2)}); ` +
            `unexplained residual ${residual >= 0 ? '+' : ''}${residual.toFixed(2)}`,
        );
      }
    }
  }
  ctx.info.plaid_drift = Object.fromEntries(
    [...results.values()].map((r) => [r.name, r.residual ?? null]),
  );
}

async function checkStarlingWindow(
  ctx: Ctx,
  hominem: HominemMcp,
  accounts: HominemAccount[],
  state: SyncStateFile,
  today: string,
  dbPath: string | undefined,
): Promise<void> {
  if (!process.env.STARLING_API_TOKEN) {
    ctx.note(
      'starling_reconciliation',
      null,
      'skipped: STARLING_API_TOKEN is not set — point the env at the token to enable the window reconciliation',
      'info',
    );
    return;
  }
  const starlingAccounts = accounts.filter((a) => a.provider === 'starling' && a.providerAccountId);
  if (starlingAccounts.length === 0) return;
  const wm = state.starling_max ?? isoMinusDays(today, 7);
  const from = isoMinusDays(wm, 1);
  const pull = await starlingPull(from, today, { dbPath });
  const feedSumByUid = new Map<string, number>();
  for (const t of pull.items) {
    if (t.status !== 'SETTLED' || !t.accountUid) continue;
    feedSumByUid.set(t.accountUid, round2((feedSumByUid.get(t.accountUid) ?? 0) + t.amount));
  }
  ctx.info.starling_window = {};
  for (const acct of starlingAccounts) {
    const uid = acct.providerAccountId!;
    const feedSum = round2(feedSumByUid.get(uid) ?? 0);
    const rows = await searchWindow(hominem, acct.id, from, today);
    const ledgerSum = round2(
      rows
        .filter((r) => r.source === 'starling' && r.currencyCode === acct.currencyCode)
        .reduce((s, r) => s + r.amount, 0),
    );
    (ctx.info.starling_window as Record<string, unknown>)[acct.name] = {
      from,
      feed_sum: feedSum,
      ledger_sum: ledgerSum,
    };
    if (Math.abs(feedSum - ledgerSum) > STARLING_TOLERANCE) {
      ctx.note(
        'starling_reconciliation',
        acct.name,
        `settled feed transactions ${from}..${today} sum to ${feedSum.toFixed(2)} ${acct.currencyCode} ` +
          `but ledger rows from Starling sum to ${ledgerSum.toFixed(2)} ${acct.currencyCode} ` +
          `(difference ${ledgerSum >= feedSum ? '+' : ''}${(ledgerSum - feedSum).toFixed(2)})`,
      );
    }
  }
}

async function checkAnchorFreshness(
  ctx: Ctx,
  hominem: HominemMcp,
  dir: string,
  today: string,
): Promise<void> {
  const anchors = readOptionalJson<Record<string, number>>(join(dir, 'manual_anchors.json'));
  if (!anchors) {
    ctx.note(
      'anchor_freshness',
      null,
      'skipped: no manual_anchors.json in the wealth dir — no manual-refresh thresholds on file; ' +
        'add {"Account Display Name": maxAgeDays} to enable',
      'info',
    );
    return;
  }
  const nw = await hominem.netWorth();
  const seen: Record<string, string | null> = {};
  for (const a of nw.accounts as NetWorthAccount[]) {
    const maxAge = anchors[a.name];
    if (maxAge === undefined) continue;
    seen[a.name] = a.balanceAsOf;
    if (!a.balanceAsOf) {
      ctx.note('anchor_freshness', a.name, 'no balance anchor date recorded');
      continue;
    }
    const age = isoDaysBetween(a.balanceAsOf, today);
    if (age > maxAge) {
      ctx.note(
        'anchor_freshness',
        a.name,
        `manual anchor is ${age} days old (as of ${a.balanceAsOf}); ` +
          `balance ${a.balance} ${a.currencyCode} may have drifted — refresh from the issuer when convenient`,
      );
    }
  }
  ctx.info.manual_anchors = seen;
}

interface CancellationWatch {
  id?: string;
  merchant?: string;
  status?: string;
  escalate_if?: string;
}

async function checkCancellationWatches(
  ctx: Ctx,
  hominem: HominemMcp,
  dir: string,
  today: string,
): Promise<void> {
  const watches = readOptionalJson<CancellationWatch[]>(join(dir, 'cancellation_watches.json'));
  if (!watches) return; // optional input, archived behavior: absent = nothing to watch
  const seenWatches: { id?: string; status?: string }[] = [];
  for (const w of watches) {
    if (
      !String(w.status ?? '')
        .toLowerCase()
        .startsWith('open')
    )
      continue;
    const merchant = w.merchant ?? '';
    const token = merchant.split(/\s+/)[0] ?? '';
    const dates = (w.escalate_if ?? '').match(/\d{4}-\d{2}-\d{2}/g) ?? [];
    const chargeFrom = dates[0] ?? null;
    const confirmBy = dates.length > 1 ? dates[dates.length - 1] : null;
    // Post-cancellation charge scan: any charge after the cancellation.
    const res = await hominem.searchTransactions({ query: token, from: SWEEP_FROM, limit: 50 });
    for (const t of res.transactions) {
      if (t.amount < 0 && chargeFrom && t.postedOn >= chargeFrom) {
        ctx.note(
          'cancellation_watch',
          merchant,
          `CHARGE POSTED after cancellation: ${t.amount} ${t.currencyCode} on ${t.postedOn} ` +
            `(${t.accountName}) — watch ${w.id}`,
        );
      }
    }
    seenWatches.push({ id: w.id, status: w.status });
    if (confirmBy && today > confirmBy) {
      ctx.note(
        'cancellation_watch',
        merchant,
        `no substantive confirmation recorded by ${confirmBy} (watch ${w.id}); ` +
          `status still "${w.status}" — check email for a confirmation before treating as escalated`,
      );
    }
  }
  if (seenWatches.length > 0) ctx.info.watches = seenWatches;
}

async function checkStatementPayments(
  ctx: Ctx,
  hominem: HominemMcp,
  accounts: HominemAccount[],
  today: string,
  dbPath: string | undefined,
): Promise<void> {
  if (!process.env.PLAID_ACCESS_TOKEN) {
    ctx.note(
      'payment_verification',
      null,
      'skipped: PLAID_ACCESS_TOKEN is not set — run hominem plaid auth to enable statement verification',
      'info',
    );
    return;
  }
  // The aggregate `plaid liabilities` read fails wholesale when any one
  // institution has no liability accounts (Wise: NO_LIABILITY_ACCOUNTS),
  // so read per credential and merge; a failing institution is skipped.
  const byId = new Map<string, { mask?: string }>();
  const credit: {
    account_id?: string;
    last_statement_balance?: number | null;
    last_statement_issue_date?: string | null;
    last_payment_due_date?: string | null;
    next_payment_due_date?: string | null;
  }[] = [];
  const skipped: { institution?: string; error: string }[] = [];
  const instBody = await plaidAccounts({ dbPath });
  for (const inst of instBody.institutions ?? []) {
    const cred = inst.credential_id;
    if (!cred) continue;
    try {
      const body = await plaidLiabilities(cred, { dbPath });
      for (const a of body.accounts ?? []) byId.set(a.account_id ?? '', a);
      credit.push(...(body.liabilities?.credit ?? []));
    } catch (err) {
      skipped.push({ institution: inst.display_name, error: (err as Error).message.slice(0, 120) });
    }
  }
  if (skipped.length > 0) ctx.info.liabilities_skipped = skipped;
  ctx.info.liability_cards = credit.length;
  const statements: Record<string, unknown>[] = [];
  for (const c of credit) {
    const mask = byId.get(c.account_id ?? '')?.mask ?? '';
    const hits = accounts.filter((acc) => acc.accountNumber === mask);
    if (hits.length !== 1) continue;
    const acct = hits[0];
    const stmtBal = c.last_statement_balance ?? null;
    const issue = c.last_statement_issue_date ?? null;
    const due = c.next_payment_due_date ?? c.last_payment_due_date ?? null;
    if (stmtBal === null || issue === null || due === null) continue;
    const graceEnd = isoPlusDays(due, 3);
    const windowTo = graceEnd > today ? graceEnd : today;
    const rows = await searchWindow(hominem, acct.id, issue, windowTo);
    // ALL payments in the window count — the two rules bought with the
    // 2026-10-28 Amex false flag. "normalization" is the ledger's
    // balance-plug token, carried verbatim.
    const paid = round2(
      rows
        .filter(
          (r) =>
            r.amount > 0 &&
            !r.excluded &&
            (r.transactionType === 'credit' || r.transactionType === 'transfer') &&
            !(r.description ?? '').toLowerCase().includes('normalization'),
        )
        .reduce((s, r) => s + r.amount, 0),
    );
    const short = round2(stmtBal - paid);
    statements.push({ account: acct.name, statement: stmtBal, issue, due, paid_in_window: paid });
    if (today > graceEnd && short > 0.01) {
      ctx.note(
        'payment_verification',
        acct.name,
        `statement of ${stmtBal.toFixed(2)} issued ${issue} was due ${due}; ` +
          `payments in [issue, due+3d] sum to ${paid.toFixed(2)} — short ${short.toFixed(2)}. ` +
          'Verify in the issuer app before assuming a miss (feeds have disagreed before; see the 2026-10-28 Amex resolution)',
      );
    }
  }
  if (statements.length > 0) ctx.info.statements = statements;
}

// ----------------------------------------------------------------- main

interface CheckEnvelope {
  ok: boolean;
  date: string;
  flags: Flag[];
  info: Record<string, unknown>;
  run_id: number;
}

async function runCheck(dbPath: string | undefined, runId: number): Promise<CheckEnvelope> {
  const today = todayIso();
  const dir = wealthDir();
  const ctx = new Ctx();

  const hominem = new HominemMcp({ dbPath });
  const accounts = (await hominem.listFinanceAccounts()).accounts;
  const summary = await hominem.accountSummary();
  const summaries = new Map(summary.accounts.map((a) => [a.accountId, a]));

  const state = checkFeedHealth(ctx, dir, today);

  // Each check is independent: one failing check is a flag, never the
  // end of the run (the archived contract).
  try {
    await checkPlaidDrift(ctx, accounts, summaries, today, dbPath);
  } catch (err) {
    ctx.note('balance_drift', null, `Plaid drift check failed: ${(err as Error).message}`);
  }
  try {
    await checkStarlingWindow(ctx, hominem, accounts, state, today, dbPath);
  } catch (err) {
    ctx.note('starling_reconciliation', null, `check failed: ${(err as Error).message}`);
  }
  try {
    await checkAnchorFreshness(ctx, hominem, dir, today);
  } catch (err) {
    ctx.note('anchor_freshness', null, `check failed: ${(err as Error).message}`);
  }
  try {
    await checkCancellationWatches(ctx, hominem, dir, today);
  } catch (err) {
    ctx.note('cancellation_watch', null, `check failed: ${(err as Error).message}`);
  }
  try {
    await checkStatementPayments(ctx, hominem, accounts, today, dbPath);
  } catch (err) {
    ctx.note('payment_verification', null, `check failed: ${(err as Error).message}`);
  }

  return { ok: true, date: today, flags: ctx.flags, info: ctx.info, run_id: runId };
}

export async function main(): Promise<number> {
  applyEnvDefaults();
  const dbPath = process.env.HOMINEM_AGENT_DB; // undefined = the default audit db
  const runId = logRun('wealth-integrity', {
    status: 'invoked',
    context: { today: todayIso(), dir: wealthDir() },
    path: dbPath,
  });
  try {
    const envelope = await runCheck(dbPath, runId);
    const realFlags = envelope.flags.filter((f) => f.severity === 'flag').length;
    finishRun(runId, {
      status: 'ok',
      exitCode: 0,
      message: `${realFlags} flag${realFlags === 1 ? '' : 's'}, ${envelope.flags.length - realFlags} info notes`,
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
