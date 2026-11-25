/**
 * Plaid CLI bridge — the hatch box's `plaid` binary is the system of
 * record for the JSON contract below, and no `plaid` binary exists on
 * this Mac (checked 2026-11-22). Law 4 says resolve the binary from env.
 * Every command consumes the same stdout JSON the archived Python
 * consumed:
 *
 *   {ok: boolean, body: {institutions, accounts, transactions, …} | string,
 *    output_file?: string}
 *
 * where accounts carry `_plaid_source.credential_id` joining them to
 * `institutions[].credential_id`. A string body is a pointer: read the
 * real payload from `output_file`. This file holds no Plaid credentials —
 * the CLI owns auth (Plaid is INGEST ONLY, Charlie 2026-11-06: feeds
 * transactions into Hominem, never a source for analysis).
 *
 * Commands (each one invocation, one `events` row — law 1):
 *   transactions-get --start-date D --end-date D   the txn feed (the sync)
 *   accounts                                         balances + institutions
 *   liabilities --credential-id C                     card statements (Layer 1)
 *
 * Rows carry the feed mask as their route identity; daily_sync resolves
 * it against Hominem's finance_accounts (the mask is stored there as
 * the account's accountNumber). No mask→label map lives in this repo
 * (Charles's ruling, 2026-11-22: no personal financial data here).
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { logEvent } from '../../log/agent_log.ts';
import { categorize, classifyRow, tagsFor } from './categorize.ts';
import { requireEnv } from './env.ts';
import { round2, type SyncDoctrine, type SyncRow } from './types.ts';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface PlaidPullResult {
  rows: SyncRow[];
}

export interface PlaidConfig {
  cli?: string;
  dbPath?: string;
  timeoutMs?: number;
}

export interface PlaidBody {
  institutions?: { display_name?: string; credential_id?: string; read_status?: string }[];
  accounts?: {
    account_id?: string;
    name?: string;
    mask?: string;
    type?: string;
    balances?: { current?: number | null; iso_currency_code?: string | null };
    _plaid_source?: { credential_id?: string };
  }[];
  transactions?: {
    account_id?: string;
    date?: string;
    pending?: boolean;
    merchant_name?: string;
    name?: string;
    amount?: number;
    iso_currency_code?: string;
    unofficial_currency_code?: string;
  }[];
  /** liabilities --credential-id: per-card statement state. */
  liabilities?: {
    credit?: {
      account_id?: string;
      last_statement_balance?: number | null;
      last_statement_issue_date?: string | null;
      last_payment_due_date?: string | null;
      next_payment_due_date?: string | null;
    }[];
  };
}

/**
 * One `plaid <cmd>` invocation: resolve the binary, parse the envelope
 * (a string body points at output_file), log exactly one events row,
 * and throw loudly on any failure shape. Mirrors the archived
 * wrapper's semantics — a set-but-failing CLI is fatal, never silent.
 */
export async function plaidCommand(
  cmd: string,
  cmdArgs: string[],
  cfg: PlaidConfig = {},
): Promise<PlaidBody> {
  const cli = cfg.cli ?? requireEnv('PLAID_CLI');
  const timeoutMs = cfg.timeoutMs ?? 300_000; // the archived sync's 300s
  const args = [cmd, ...cmdArgs];
  const tsRequest = new Date().toISOString();
  const tsRequestMs = Date.now();

  const { status, stdout, stderr } = await new Promise<{
    status: number | null;
    stdout: string;
    stderr: string;
  }>((resolve) => {
    const proc = spawn(cli, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => proc.kill('SIGKILL'), timeoutMs);
    proc.stdout!.on('data', (d) => (out += d));
    proc.stderr!.on('data', (d) => (err += d));
    proc.on('error', (e) => {
      clearTimeout(timer);
      resolve({ status: null, stdout: out, stderr: e.message });
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ status: code, stdout: out, stderr: err });
    });
  });

  let data: { ok?: boolean; body?: PlaidBody | string; output_file?: string };
  try {
    data = JSON.parse(stdout);
  } catch {
    logEvent('plaid', args, {
      tsRequest,
      tsRequestMs,
      tsResponse: new Date().toISOString(),
      tsResponseMs: Date.now(),
      ok: false,
      isError: true,
      exitCode: status ?? undefined,
      stderr: (stderr || stdout).slice(0, 300),
      error: 'plaid stdout was not JSON',
      path: cfg.dbPath,
    });
    throw new Error(`plaid ${cmd} failed: ${(stderr || stdout).slice(0, 300)}`);
  }

  let body: PlaidBody;
  let bodyError: string | null = null;
  if (typeof data.body === 'string') {
    // A string body is a pointer to output_file — or, with no output_file,
    // the failure message itself (surfaced, never swallowed).
    if (data.output_file) {
      try {
        body =
          (JSON.parse(readFileSync(data.output_file, 'utf8')) as { body?: PlaidBody }).body ?? {};
      } catch (err) {
        bodyError = `plaid output_file unreadable: ${(err as Error).message}`;
        body = {};
      }
    } else {
      bodyError = `plaid read failed: ${data.body.slice(0, 300)}`;
      body = {};
    }
  } else {
    body = data.body ?? {};
  }

  // One events row per invocation, whatever the outcome (law 1).
  const ok = data.ok === true && status === 0 && bodyError === null;
  logEvent('plaid', args, {
    tsRequest,
    tsRequestMs,
    tsResponse: new Date().toISOString(),
    tsResponseMs: Date.now(),
    ok,
    isError: !ok,
    error: bodyError ?? undefined,
    httpStatus: 200,
    exitCode: status ?? undefined,
    stderr: stderr.slice(0, 300) || undefined,
    response: {
      ok: data.ok,
      institutions: body.institutions?.length,
      accounts: body.accounts?.length,
      transactions: body.transactions?.length,
    },
    path: cfg.dbPath,
  });

  if (status !== 0 && status !== null) {
    throw new Error(`plaid ${cmd} failed: ${(stderr || stdout).slice(0, 300)}`);
  }
  if (bodyError) throw new Error(bodyError);
  if (!data.ok) {
    const insts = (body.institutions ?? []).map(
      (i) => `${i.display_name}: ${i.read_status ?? 'unknown'}`,
    );
    throw new Error(`plaid ${cmd} read failed; institutions: ${insts.join(', ')}`);
  }
  return body;
}

/** `plaid accounts` — balances per account plus institutions/credentials. */
export async function plaidAccounts(cfg: PlaidConfig = {}): Promise<PlaidBody> {
  return await plaidCommand('accounts', [], cfg);
}

/** `plaid liabilities --credential-id C` — card statement state per credential. */
export async function plaidLiabilities(
  credentialId: string,
  cfg: PlaidConfig = {},
): Promise<PlaidBody> {
  return await plaidCommand('liabilities', ['--credential-id', credentialId], cfg);
}

/** `plaid transactions-get` over a raw window — the settled gap read (Layer 1). */
export async function plaidTransactionsWindow(
  from: string,
  to: string,
  cfg: PlaidConfig = {},
): Promise<PlaidBody> {
  return await plaidCommand('transactions-get', ['--start-date', from, '--end-date', to], cfg);
}

export async function plaidPull(
  since: string,
  today: string,
  cfg: PlaidConfig = {},
  doctrine: SyncDoctrine,
): Promise<PlaidPullResult> {
  const body = await plaidCommand(
    'transactions-get',
    ['--start-date', since, '--end-date', today],
    cfg,
  );

  const instNameByCred = new Map<string, string>();
  for (const i of body.institutions ?? [])
    instNameByCred.set(i.credential_id ?? '', i.display_name ?? '');

  const acctMeta = new Map<string, { inst: string; name: string; mask: string }>();
  for (const a of body.accounts ?? []) {
    const cred = a._plaid_source?.credential_id ?? '';
    acctMeta.set(a.account_id ?? '', {
      inst: instNameByCred.get(cred) ?? '',
      name: a.name ?? '',
      mask: a.mask ?? '',
    });
  }

  const rows: SyncRow[] = [];
  for (const t of body.transactions ?? []) {
    // The Hominem import rejects pending rows loudly (pending_row); the
    // sync skips them instead — the settled row arrives on a later run.
    if (t.pending) continue;
    const meta = acctMeta.get(t.account_id ?? '') ?? { inst: '', name: '', mask: '' };
    // The provisional hold-out label — what the row is called if it
    // never routes. The mask is the routing identity.
    const label = `${meta.inst} ${meta.name} …${meta.mask}`.trim();
    const cur = t.iso_currency_code ?? t.unofficial_currency_code ?? '';
    const merchant = t.merchant_name ?? t.name ?? '';
    const amount = round2(-(t.amount ?? 0)); // Plaid positive = outflow
    const cat =
      classifyRow(merchant, Math.round(amount * 100), label, doctrine) ||
      categorize(merchant, Math.round(amount * 100), doctrine);
    const row: SyncRow = {
      date: t.date ?? '',
      label,
      route: meta.mask ? { provider: 'plaid', mask: meta.mask } : undefined,
      merchant,
      amount,
      currency: cur,
      tags: tagsFor(merchant, cat, doctrine),
      source: 'Plaid',
      orderNumber: '',
      category: cat,
    };
    if (DATE_RE.test(row.date)) rows.push(row);
  }
  return { rows };
}
