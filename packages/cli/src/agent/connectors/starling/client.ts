import { envOr, requireEnv } from '../../../env.ts';
import { asRecord, errorText, optionalString, records } from '../../guards.ts';
/**
 * Starling Bank native client — ported from the archived
 * custom.legacy-starling/bin/pull.py (`transactions` command), which the
 * hatch sync shelled out to. The port calls the same four endpoints
 * directly, so the surrogate-injection auth (`custom.starling` via
 * /opt/muse dynamic_credentials) is replaced by the env-resolved bearer
 * token STARLING_API_TOKEN (law 4: secrets live in the environment; the
 * CONNECTOR.md lesson stays true — a 401 is a question about whether the
 * credential was attached before it is a question about the key).
 *
 * Window semantics, carried faithfully from pull.py: `since` and `until`
 * are calendar dates parsed at midnight UTC, so the feed window is
 * [since 00:00, until 00:00) — activity on `until` itself is picked up by
 * the next run (the -1 day overlap makes that safe).
 *
 * Every HTTP call lands one `events` row in the audit db (law 1). Savings
 * goals failing is a note, not silence: the archived connector swallowed
 * the failure, which made a broken Spaces read look like "no Spaces".
 *
 * starlingBalances is the one read with no archived precedent (pull.py's
 * `accounts` listed metadata only): the live /balance endpoint, so
 * "what have I got right now" never waits on a sync or a Hominem window.
 */
import { logEvent } from '../../log/agent_log.ts';

/** Round to 2dp the way the archived sync did (Python round(x, 2)). */
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

const DEFAULT_BASE = 'https://api.starlingbank.com';

/** pull.py's normalized feed item — the connector's output contract. */
interface StarlingItem {
  feedItemUid: string | null;
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  direction: string;
  status: string | null;
  reference: string | null;
  accountUid: string | null;
  /** Raw Starling source, e.g. INTERNAL_TRANSFER for account↔Space moves. */
  src: string | null;
  /** Space (savings goal) this item belongs to; null = the main feed. */
  space: string | null;
}

export interface StarlingPullResult {
  items: StarlingItem[];
  notes: string[];
}

export interface StarlingConfig {
  token?: string;
  baseUrl?: string;
  /** Audit db override (tests). */
  dbPath?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Resolved client context — one per routine, shared by every apiGet. */
interface ApiCtx {
  token: string;
  base: string;
  timeoutMs: number;
  cfg: StarlingConfig;
}

function apiCtx(cfg: StarlingConfig): ApiCtx {
  return {
    token: cfg.token ?? requireEnv('STARLING_API_TOKEN'),
    base: (cfg.baseUrl ?? envOr('STARLING_API_BASE', DEFAULT_BASE)).replace(/\/$/, ''),
    timeoutMs: cfg.timeoutMs ?? 30_000, // pull.py's urlopen timeout
    cfg,
  };
}

/** One logged GET (law 1) — the shared transport for pull and balances. */
async function apiGet(
  ctx: ApiCtx,
  path: string,
  params?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = new URL(ctx.base + path);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
  const tsRequest = new Date().toISOString();
  const tsRequestMs = Date.now();
  let parsed: unknown;
  let httpStatus = 0;
  try {
    const resp = await (ctx.cfg.fetchImpl ?? fetch)(url, {
      headers: { accept: 'application/json', authorization: `Bearer ${ctx.token}` },
      signal: AbortSignal.timeout(ctx.timeoutMs),
    });
    httpStatus = resp.status;
    parsed = await resp.json();
    if (!resp.ok) {
      throw new Error(`starling ${path} returned HTTP ${resp.status}`);
    }
  } catch (err) {
    logEvent('starling', ['GET', path], {
      tsRequest,
      tsRequestMs,
      tsResponse: new Date().toISOString(),
      tsResponseMs: Date.now(),
      httpStatus,
      ok: false,
      isError: true,
      error: errorText(err),
      path: ctx.cfg.dbPath,
    });
    throw err;
  }
  logEvent('starling', ['GET', path], {
    tsRequest,
    tsRequestMs,
    tsResponse: new Date().toISOString(),
    tsResponseMs: Date.now(),
    httpStatus,
    ok: true,
    params: Object.fromEntries(url.searchParams),
    response: parsed,
    path: ctx.cfg.dbPath,
  });
  return asRecord(parsed) ?? {};
}

export async function starlingPull(
  since: string,
  until: string,
  cfg: StarlingConfig = {},
): Promise<StarlingPullResult> {
  const ctx = apiCtx(cfg);
  const notes: string[] = [];

  // Faithful window: both bounds at midnight UTC, pull.py's naive-datetime
  // coercion (`replace(tzinfo=utc).isoformat()`).
  const win = {
    minTransactionTimestamp: `${since}T00:00:00+00:00`,
    maxTransactionTimestamp: `${until}T00:00:00+00:00`,
  };

  // The archived connector built `feed_items` as a sync helper; the port
  // keeps the same shape with an async one.
  async function collectFeedItems(
    uid: string,
    category: string,
    space: string | null,
    acctCurrency: string,
  ): Promise<StarlingItem[]> {
    const data = await apiGet(
      ctx,
      `/api/v2/feed/account/${uid}/category/${category}/transactions-between`,
      win,
    );
    const out: StarlingItem[] = [];
    for (const f of records(data['feedItems'])) {
      const amt = asRecord(f['amount']) ?? {};
      // minorUnits may arrive as a string — coerce, never parse-fail.
      const minor = Number(amt['minorUnits'] ?? 0);
      const direction = optionalString(f['direction']) ?? '';
      const signed = direction === 'OUT' ? -(minor / 100) : minor / 100;
      out.push({
        feedItemUid: optionalString(f['feedItemUid']) ?? null,
        date: (
          optionalString(f['transactionTime']) ??
          optionalString(f['transactedAt']) ??
          ''
        ).slice(0, 10),
        merchant:
          optionalString(f['counterPartyName']) ??
          optionalString(f['reference']) ??
          optionalString(f['source']) ??
          '',
        amount: round2(signed),
        currency: optionalString(amt['currency']) ?? acctCurrency,
        direction,
        status: optionalString(f['status']) ?? null,
        reference: optionalString(f['reference']) ?? null,
        accountUid: uid,
        src: optionalString(f['source']) ?? null,
        space,
      });
    }
    return out;
  }

  const accountsBody = await apiGet(ctx, '/api/v2/accounts');
  const accounts = records(accountsBody['accounts']).map((a) => ({
    accountUid: String(a['accountUid']),
    defaultCategory: String(a['defaultCategory']),
    currency: String(a['currency']),
  }));

  const items: StarlingItem[] = [];
  for (const acct of accounts) {
    const uid = acct.accountUid;
    items.push(...(await collectFeedItems(uid, acct.defaultCategory, null, acct.currency)));
    // Spaces are savings goals; each goal is its own feed category. A
    // failure is noted, never silent (see file header).
    try {
      const goals = await apiGet(ctx, `/api/v2/account/${uid}/savings-goals`);
      for (const g of records(goals['savingsGoalList'])) {
        const goalUid = String(g['savingsGoalUid']);
        const name = optionalString(g['name']) ?? null;
        items.push(...(await collectFeedItems(uid, goalUid, name, acct.currency)));
      }
    } catch (err) {
      notes.push(
        `savings goals unavailable for ${uid.slice(0, 8)}: ${errorText(err)} — ` +
          `Space feed rows for this account were not pulled`,
      );
    }
  }
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { items, notes };
}

/** One Space (savings goal) balance under its account. */
interface StarlingSpaceBalance {
  name: string;
  saved: number;
  target: number | null;
}

/** One account's live balance as the bank reports it (v2 /balance). */
interface StarlingBalance {
  accountUid: string;
  name: string;
  accountType: string;
  currency: string;
  /**
   * Main-feed figures (the default category) — Starling keeps Spaces
   * (savings goals) in their own categories, so Spaces sit outside
   * these numbers and are reported alongside, never inside them.
   */
  cleared: number;
  effective: number;
  pending: number;
  overdraft: number;
  spaces: StarlingSpaceBalance[];
}

export interface StarlingBalancesResult {
  accounts: StarlingBalance[];
  notes: string[];
}

/** Starling money objects are {currency, minorUnits} — coerce, never fail. */
function minorToMajor(m: unknown): number {
  const minor = Number(asRecord(m)?.['minorUnits'] ?? 0);
  return round2(minor / 100);
}

/**
 * Live balances, straight from the bank: every account's /balance plus
 * its Spaces (savings goals). A per-account balance failure is a named
 * note and a skip — a missing row is honest, a guessed number is not;
 * Spaces failures are notes, never silence (the pull's lesson). The
 * accounts call is the backbone: it failing fails the whole read.
 */
export async function starlingBalances(cfg: StarlingConfig = {}): Promise<StarlingBalancesResult> {
  const ctx = apiCtx(cfg);
  const notes: string[] = [];
  const accountsBody = await apiGet(ctx, '/api/v2/accounts');
  const accounts: StarlingBalance[] = [];
  for (const a of records(accountsBody['accounts'])) {
    const uid = String(a['accountUid']);
    const name = String(a['name'] ?? uid.slice(0, 8));
    let bal: Record<string, unknown>;
    try {
      bal = await apiGet(ctx, `/api/v2/accounts/${uid}/balance`);
    } catch (err) {
      notes.push(`balance unavailable for ${name}: ${errorText(err)}`);
      continue;
    }
    const spaces: StarlingSpaceBalance[] = [];
    try {
      const goals = await apiGet(ctx, `/api/v2/account/${uid}/savings-goals`);
      for (const g of records(goals['savingsGoalList'])) {
        spaces.push({
          name: optionalString(g['name']) ?? optionalString(g['savingsGoalUid']) ?? 'Space',
          saved: minorToMajor(g['totalSaved']),
          target: g['target'] ? minorToMajor(g['target']) : null,
        });
      }
    } catch (err) {
      notes.push(`savings goals unavailable for ${name}: ${errorText(err)}`);
    }
    accounts.push({
      accountUid: uid,
      name,
      accountType: String(a['accountType'] ?? ''),
      currency: String(bal['currency'] ?? a['currency']),
      cleared: minorToMajor(bal['clearedBalance']),
      effective: minorToMajor(bal['effectiveBalance']),
      pending: minorToMajor(bal['pendingTransactions']),
      overdraft: minorToMajor(bal['acceptedOverdraft']),
      spaces,
    });
  }
  return { accounts, notes };
}

/**
 * The accounts backbone alone — identity list, no balances. The seed
 * uses this to provision Hominem's routing registry: one GET, one
 * events row, and every account's bank-side UID as the identity the
 * sync routes by.
 */
export interface StarlingAccountIdentity {
  accountUid: string;
  name: string;
  accountType: string;
  currency: string;
}

export async function starlingAccounts(
  cfg: StarlingConfig = {},
): Promise<StarlingAccountIdentity[]> {
  const ctx = apiCtx(cfg);
  const body = await apiGet(ctx, '/api/v2/accounts');
  const accounts: StarlingAccountIdentity[] = [];
  for (const a of records(body['accounts'])) {
    const uid = String(a['accountUid']);
    accounts.push({
      accountUid: uid,
      name: String(a['name'] ?? uid.slice(0, 8)),
      accountType: String(a['accountType'] ?? ''),
      currency: String(a['currency']),
    });
  }
  return accounts;
}
