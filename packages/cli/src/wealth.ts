import { randomInt } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

import { applyEnvDefaults } from './env.js';
import { writeFileAtomic } from './files.js';
import { getHominemAccessToken } from './hominem-auth.js';
import { HominemMcp } from './hominem.js';
import { HOMINEM_HOME } from './paths.js';
import {
  pullPlaidLiabilities,
  pullPlaidTransactions,
  pullStarlingFeeds,
  starlingAccounts,
  starlingBalances,
  WealthProviderError,
} from './wealth-providers.js';
import { accountKey } from './wealth-state.js';

/** How far behind the checkpoint to re-read, for items that settle late. Re-reads are free. */
const OVERLAP_DAYS = 14;
const FIRST_RUN_DAYS = 7;
const BATCH_SIZE = 1000;

const stateSchema = z
  .object({
    starling_max: z.iso.date().optional(),
    plaid_max: z.iso.date().optional(),
  })
  .strict();

const syncResponseSchema = z.object({
  ok: z.boolean(),
  added: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  by_source: z.record(z.string(), z.number().int().nonnegative()),
  held: z.array(z.object({ source: z.string(), date: z.iso.date() }).passthrough()),
  new_labels: z.array(z.string()),
  unmapped: z.array(z.object({}).passthrough()),
  linked: z.array(z.string()),
  rejected: z.array(z.object({ index: z.number(), reason: z.string() }).passthrough()),
  watermarks: z.object({
    starling_max: z.iso.date().nullable(),
    plaid_max: z.iso.date().nullable(),
  }),
  warnings: z.array(z.string()),
});

const seedResponseSchema = z.object({
  ok: z.boolean(),
  doctrine: z
    .object({
      status: z.enum(['created', 'replaced', 'unchanged']),
      fingerprint: z.string(),
      ruleCounts: z.record(z.string(), z.number().int().nonnegative()),
    })
    .nullable(),
  doctrine_note: z.string().optional(),
  accounts: z.array(
    z.object({
      name: z.string(),
      provider_account_id: z.string(),
      created: z.boolean(),
      id: z.string(),
    }),
  ),
});

export class WealthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WealthError';
  }
}

function minusDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

async function loadState(path: string): Promise<z.infer<typeof stateSchema>> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    throw error;
  }
  return stateSchema.parse(JSON.parse(raw));
}

async function bankHeld(
  path: string,
  held: z.infer<typeof syncResponseSchema>['held'],
): Promise<void> {
  if (!held.length) return;
  let banked: z.infer<typeof syncResponseSchema>['held'] = [];
  try {
    banked = syncResponseSchema.shape.held.parse(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  const seen = new Set(banked.map((row) => JSON.stringify(row)));
  for (const row of held) {
    const key = JSON.stringify(row);
    if (!seen.has(key)) banked.push(row);
    seen.add(key);
  }
  await writeFileAtomic(path, `${JSON.stringify(banked, null, 2)}\n`);
}

function wealthDir(): string {
  return process.env.HOMINEM_AGENT_WEALTH_DIR ?? join(HOMINEM_HOME, 'wealth');
}

async function logRun(
  key: string,
  entry: Record<string, string | number | boolean>,
): Promise<void> {
  const dir = wealthDir();
  await mkdir(dir, { recursive: true });
  await appendFile(join(dir, `runs-${key}.jsonl`), `${JSON.stringify(entry)}\n`, { mode: 0o600 });
}

function starlingConfig() {
  const token = process.env.STARLING_API_TOKEN;
  if (!token) throw new WealthError('Set STARLING_API_TOKEN to access Starling.');
  return { token, baseUrl: process.env.STARLING_API_BASE };
}

function plaidConfig() {
  const accessToken = process.env.PLAID_ACCESS_TOKEN;
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!accessToken || !clientId || !secret) return undefined;
  const environment = process.env.PLAID_ENV ?? 'sandbox';
  if (environment !== 'sandbox' && environment !== 'production') {
    throw new WealthError('PLAID_ENV must be sandbox or production.');
  }
  return {
    clientId,
    secret,
    accessToken,
    environment,
    baseUrl: process.env.PLAID_API_BASE,
  } as const;
}

export async function seed(): Promise<number> {
  applyEnvDefaults();
  let doctrine: unknown;
  const path = process.env.WEALTH_SEED_DOCTRINE;
  if (path) {
    let raw: string;
    try {
      raw = await readFile(path, 'utf8');
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw new WealthError(`WEALTH_SEED_DOCTRINE could not be read (${error.code}).`);
      }
      throw error;
    }
    try {
      doctrine = z.record(z.string(), z.unknown()).parse(JSON.parse(raw));
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof z.ZodError) {
        throw new WealthError('WEALTH_SEED_DOCTRINE must contain one JSON object.');
      }
      throw error;
    }
  }
  const token = await getHominemAccessToken();
  const accounts = await starlingAccounts(starlingConfig());
  if (!accounts.length) throw new WealthError('Starling returned no accounts to seed.');
  const hominem = new HominemMcp({ token: token.access_token, url: `${token.api_url}/api/mcp` });
  const response = seedResponseSchema.parse(
    await hominem.call('finance_seed', { accounts, ...(doctrine ? { doctrine } : {}) }),
  );
  const result = { ...response, run_id: randomInt(1, 2 ** 48 - 1) };
  await logRun(await accountKey(wealthDir(), token), {
    run_id: result.run_id,
    ok: result.ok,
    accounts: accounts.length,
  });
  console.log(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

export async function balances(): Promise<number> {
  applyEnvDefaults();
  const token = await getHominemAccessToken();
  const snapshot = await starlingBalances(starlingConfig());
  const hominem = new HominemMcp({ token: token.access_token, url: `${token.api_url}/api/mcp` });
  const response = z
    .object({ text: z.string() })
    .parse(await hominem.call('finance_balances', { ...snapshot, at: new Date().toISOString() }));
  await logRun(await accountKey(wealthDir(), token), {
    run_id: randomInt(1, 2 ** 48 - 1),
    ok: true,
    accounts: snapshot.accounts.length,
    notes: snapshot.notes.length,
  });
  console.log(response.text);
  return 0;
}

export interface SyncOptions {
  bank?: 'starling';
  from?: string;
  until?: string;
  dryRun?: boolean;
}

function resolveSyncOptions({ bank, from, until: end, dryRun = false }: SyncOptions) {
  // Bank timestamps are UTC, so "today" has to be too. A local date would cut off evening
  // spending west of Greenwich and leave the checkpoint ahead of the next run's end date.
  const until = end ?? process.env.WEALTH_SYNC_TODAY ?? new Date().toISOString().slice(0, 10);
  const dates = from === undefined ? [until] : [from, until];
  if (!dates.every((date) => z.iso.date().safeParse(date).success)) {
    throw new WealthError('Sync dates must be valid YYYY-MM-DD calendar dates.');
  }
  if (from && from > until) throw new WealthError('The sync start must not be after its end.');
  return { bank, from, until, dryRun };
}

export async function sync(options: SyncOptions = {}): Promise<number> {
  applyEnvDefaults();
  const { bank, from, until, dryRun } = resolveSyncOptions(options);
  const token = await getHominemAccessToken();
  const dir = wealthDir();
  const userKey = await accountKey(dir, token);
  const statePath = join(dir, `sync-${userKey}.json`);
  const state = await loadState(statePath);
  const since = (checkpoint: string | undefined) =>
    from ?? minusDays(checkpoint ?? until, checkpoint ? OVERLAP_DAYS : FIRST_RUN_DAYS);
  const windows = {
    starling_since: since(state.starling_max),
    plaid_since: since(state.plaid_max),
    until,
  };
  const wantsPlaid = bank !== 'starling';
  // The overlap would hide a checkpoint that's past `until`, so check the checkpoints themselves.
  const checkpoints = [state.starling_max, wantsPlaid ? state.plaid_max : undefined];
  if (!from && checkpoints.some((checkpoint) => checkpoint && checkpoint > until)) {
    throw new WealthError(
      'The sync checkpoint is after the requested end date; pass --from explicitly.',
    );
  }

  const starlingToken = process.env.STARLING_API_TOKEN;
  const plaidAccessToken = process.env.PLAID_ACCESS_TOKEN;
  const plaidClientId = process.env.PLAID_CLIENT_ID;
  const plaidSecret = process.env.PLAID_SECRET;
  const plaidConfigured = Boolean(plaidAccessToken && plaidClientId && plaidSecret);
  if (bank === 'starling' && !starlingToken) {
    throw new WealthError('Set STARLING_API_TOKEN to sync Starling.');
  }
  if (!starlingToken && !plaidConfigured)
    throw new WealthError(
      'Configure STARLING_API_TOKEN or all Plaid credentials to sync a provider.',
    );
  const warnings: string[] = [];
  if (wantsPlaid && !plaidConfigured) {
    const missing = [
      !plaidClientId && 'PLAID_CLIENT_ID',
      !plaidSecret && 'PLAID_SECRET',
      !plaidAccessToken && 'PLAID_ACCESS_TOKEN',
    ].filter(Boolean);
    warnings.push(`Plaid skipped: ${missing.join(', ')} not set.`);
  }
  if (!starlingToken) warnings.push('Starling skipped: STARLING_API_TOKEN is not set.');
  const starling = starlingToken
    ? await pullStarlingFeeds(windows.starling_since, until, {
        token: starlingToken,
        baseUrl: process.env.STARLING_API_BASE,
      })
    : { feeds: [], notes: [] };
  warnings.push(...starling.notes);
  const plaidOptions = wantsPlaid ? plaidConfig() : undefined;
  const plaid = plaidOptions
    ? await pullPlaidTransactions(windows.plaid_since, until, plaidOptions)
    : undefined;

  const batches: Array<Record<string, unknown>> = [];
  // One account's feeds (main plus spaces) travel together, so the server matches them
  // against the ledger in one go.
  for (const accountUid of new Set(starling.feeds.map((feed) => feed.accountUid))) {
    let batch: typeof starling.feeds = [];
    let size = 0;
    for (const feed of starling.feeds.filter((entry) => entry.accountUid === accountUid)) {
      for (let offset = 0; offset < feed.feedItems.length;) {
        const feedItems = feed.feedItems.slice(offset, offset + BATCH_SIZE - size);
        batch.push({ ...feed, feedItems });
        offset += feedItems.length;
        size += feedItems.length;
        if (size === BATCH_SIZE) {
          batches.push({ starling: batch });
          batch = [];
          size = 0;
        }
      }
    }
    if (batch.length) batches.push({ starling: batch });
  }
  if (plaid) {
    for (let offset = 0; offset < plaid.transactions.length; offset += 1000) {
      batches.push({
        plaid: { ...plaid, transactions: plaid.transactions.slice(offset, offset + 1000) },
      });
    }
  }
  if (batches.length === 0) batches.push({});

  const hominem = new HominemMcp({ token: token.access_token, url: `${token.api_url}/api/mcp` });
  const by_source: Record<string, number> = {};
  const held: z.infer<typeof syncResponseSchema>['held'] = [];
  const new_labels: string[] = [];
  const unmapped: z.infer<typeof syncResponseSchema>['unmapped'] = [];
  const linked: string[] = [];
  const result = {
    ok: true,
    added: 0,
    updated: 0,
    by_source,
    held,
    new_labels,
    unmapped,
    linked,
    windows,
    warnings,
    run_id: randomInt(1, 2 ** 48 - 1),
  };
  const watermarks: { starling_max: string | null; plaid_max: string | null } = {
    starling_max: null,
    plaid_max: null,
  };
  for (const batch of batches) {
    const response = syncResponseSchema.parse(
      await hominem.call('finance_sync', { ...batch, windows, dryRun, linkTransfers: false }),
    );
    result.ok &&= response.ok;
    result.added += response.added;
    result.updated += response.updated;
    for (const [source, count] of Object.entries(response.by_source)) {
      result.by_source[source] = (result.by_source[source] ?? 0) + count;
    }
    result.held.push(...response.held);
    result.new_labels.push(...response.new_labels);
    result.unmapped.push(...response.unmapped);
    result.linked.push(...response.linked);
    result.warnings.push(...response.warnings);
    if (response.rejected.length) {
      result.warnings.push(
        `${response.rejected.length} transaction(s) were rejected; fix the provider data and retry.`,
      );
    }
    for (const key of ['starling_max', 'plaid_max'] as const) {
      const current = response.watermarks[key];
      if (current && (!watermarks[key] || current > watermarks[key]!)) watermarks[key] = current;
    }
  }
  if (!dryRun && result.ok) {
    const response = syncResponseSchema.parse(
      await hominem.call('finance_sync', { windows, linkTransfers: true }),
    );
    result.linked.push(...response.linked);
    result.warnings.push(...response.warnings);
  }
  result.new_labels = [...new Set(result.new_labels)];
  result.warnings = [...new Set(result.warnings)];

  if (!dryRun) {
    await bankHeld(join(dir, `pending_unmapped-${userKey}.json`), result.held);
    for (const [key, source] of [
      ['starling_max', 'Starling API'],
      ['plaid_max', 'Plaid'],
    ] as const) {
      if (key === 'plaid_max' && !wantsPlaid) continue;
      const heldDates = result.held.filter((row) => row.source === source).map((row) => row.date);
      if (heldDates.length || (key === 'starling_max' && starling.notes.length) || !result.ok) {
        const fromDate = key === 'starling_max' ? windows.starling_since : windows.plaid_since;
        const retryFrom = heldDates.reduce(
          (earliest, date) => (date < earliest ? date : earliest),
          fromDate,
        );
        // The overlap already re-reads anything this close to the checkpoint. Only move it
        // back for older rows, or it'd creep further into the past on every run.
        if (!state[key] || retryFrom < minusDays(state[key], OVERLAP_DAYS)) state[key] = retryFrom;
        result.warnings.push(
          `${source} checkpoint was retained or rewound because some transactions need attention.`,
        );
        continue;
      }
      const next = watermarks[key];
      if (next && (!state[key] || next > state[key]!)) state[key] = next;
    }
    await writeFileAtomic(statePath, `${JSON.stringify(state, null, 2)}\n`);
  }
  await logRun(userKey, {
    run_id: result.run_id,
    ok: result.ok,
    added: result.added,
    updated: result.updated,
    held: result.held.length,
    dryRun,
  });
  console.log(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

const FX_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=GBP';

function today(): string {
  return process.env.WEALTH_SYNC_TODAY ?? new Date().toLocaleDateString('en-CA');
}

async function connect() {
  applyEnvDefaults();
  const token = await getHominemAccessToken();
  return {
    userKey: await accountKey(wealthDir(), token),
    hominem: new HominemMcp({ token: token.access_token, url: `${token.api_url}/api/mcp` }),
  };
}

/** Reads an optional local JSON file: absent is `{}`, unreadable or malformed is `{ error }`. */
async function readLocal(path: string): Promise<{ value?: unknown; error?: string }> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    return {
      error: `could not be read (${error instanceof Error && 'code' in error ? String(error.code) : 'unknown'})`,
    };
  }
  try {
    return { value: JSON.parse(raw) };
  } catch {
    return { error: 'is not valid JSON' };
  }
}

const envelopeSchema = z.object({ ok: z.boolean() }).passthrough();
const diagnosticsSchema = z
  .object({
    sections: z
      .object({
        diagnostics: z
          .object({
            notes: z.array(z.string()).optional(),
            source_errors: z.record(z.string(), z.string()).optional(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export async function brief(): Promise<number> {
  const { userKey, hominem } = await connect();
  const dir = wealthDir();
  const snapshotPath = join(dir, `morning_brief_bills-${userKey}.json`);
  const previous = await readLocal(snapshotPath);
  const run_id = randomInt(1, 2 ** 48 - 1);
  const response = diagnosticsSchema
    .extend({ snapshot: z.object({ bills: z.array(z.unknown()) }).nullable() })
    .parse(
      await hominem.call('finance_wealth_brief', {
        date: today(),
        run_id,
        bills_only: Boolean(process.env.WEALTH_BRIEF_BILLS_ONLY),
        snapshot: previous.value ?? null,
      }),
    );
  const { snapshot, ...result } = response;
  if (previous.error) {
    result.sections.diagnostics.source_errors = {
      ...result.sections.diagnostics.source_errors,
      snapshot_read: `${snapshotPath} ${previous.error}`,
    };
  }
  if (snapshot && !process.env.WEALTH_BRIEF_NO_WRITE_SNAPSHOT) {
    await mkdir(dir, { recursive: true });
    await writeFileAtomic(snapshotPath, `${JSON.stringify(snapshot, null, 1)}\n`);
  }
  const ok = envelopeSchema.parse(result).ok;
  await logRun(userKey, { run_id, ok, routine: 'brief' });
  console.log(JSON.stringify(result, null, 1));
  return ok ? 0 : 1;
}

async function fetchFx(): Promise<{ fx?: Record<string, unknown>; note?: string }> {
  const url = process.env.WEALTH_FX_URL ?? FX_URL;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: 'error' });
    if (!response.ok) return { note: `fx rate unavailable (HTTP ${response.status})` };
    const body = z
      .object({ rates: z.object({ GBP: z.number().positive() }), date: z.iso.date().optional() })
      .parse(await response.json());
    return {
      fx: {
        rate_usd_to_gbp: body.rates.GBP,
        rate_date: body.date ?? null,
        rate_source: 'Frankfurter (ECB reference rate), fetched live',
      },
    };
  } catch (error) {
    if (
      error instanceof TypeError ||
      error instanceof DOMException ||
      error instanceof z.ZodError ||
      error instanceof SyntaxError
    ) {
      return { note: 'fx rate unavailable (request or response failed)' };
    }
    throw error;
  }
}

export async function look(): Promise<number> {
  const { userKey, hominem } = await connect();
  const inputsPath = join(wealthDir(), 'forward_look_inputs.json');
  const inputs = await readLocal(inputsPath);
  const { fx, note } = await fetchFx();
  const result = diagnosticsSchema.parse(
    await hominem.call('finance_wealth_look', {
      as_of: today(),
      ...(inputs.value ? { inputs: inputs.value } : {}),
      ...(fx ? { fx } : {}),
    }),
  );
  const diagnostics = result.sections.diagnostics;
  const notes = [...(diagnostics.notes ?? [])];
  if (!inputs.value && !inputs.error) notes.push(`inputs file absent (${inputsPath})`);
  if (note) notes.push(note);
  diagnostics.notes = notes;
  if (inputs.error) {
    diagnostics.source_errors = {
      ...diagnostics.source_errors,
      inputs: `${inputsPath} ${inputs.error}`,
    };
  }
  const ok = envelopeSchema.parse(result).ok;
  await logRun(userKey, { run_id: randomInt(1, 2 ** 48 - 1), ok, routine: 'look' });
  console.log(JSON.stringify(result, null, 1));
  return ok ? 0 : 1;
}

export async function close(): Promise<number> {
  const date = today();
  const month =
    process.env.WEALTH_CLOSE_MONTH ??
    new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 2, 1))
      .toISOString()
      .slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    process.stderr.write('month must be YYYY-MM\n');
    return 2;
  }
  const { userKey, hominem } = await connect();
  const dir = wealthDir();
  const anchors = await readLocal(join(dir, 'monthly_close_anchors.json'));
  const cache = await readLocal(join(dir, `monthly_check_${month}_data.json`));
  const result = z.object({ md: z.string(), calls: z.number().int(), message: z.string() }).parse(
    await hominem.call('finance_wealth_close', {
      month,
      today: date,
      ...(anchors.value ? { anchors: anchors.value } : {}),
      ...(cache.value ? { cache: cache.value } : {}),
    }),
  );
  await logRun(userKey, {
    run_id: randomInt(1, 2 ** 48 - 1),
    ok: true,
    routine: 'close',
    calls: result.calls,
  });
  const out = process.env.WEALTH_CLOSE_OUT;
  if (out) {
    await writeFile(out, result.md);
    process.stdout.write(`wrote ${out} (${result.calls} calls)\n`);
  } else {
    process.stdout.write(result.md);
  }
  return 0;
}

export async function integrity(): Promise<number> {
  const { userKey, hominem } = await connect();
  const dir = wealthDir();
  const date = today();
  const state = await loadState(join(dir, `sync-${userKey}.json`)).catch(() => undefined);
  const anchors = await readLocal(join(dir, 'manual_anchors.json'));
  const watches = await readLocal(join(dir, 'cancellation_watches.json'));
  const input: Record<string, unknown> = {
    date,
    run_id: randomInt(1, 2 ** 48 - 1),
    ...(state && Object.keys(state).length ? { sync_state: state } : {}),
    ...(anchors.value ? { manual_anchors: anchors.value } : {}),
    ...(watches.value ? { cancellation_watches: watches.value } : {}),
  };
  const plaidOptions = plaidConfig();
  if (plaidOptions) {
    // A month before the checkpoint covers each ledger's gap window; the service reports shortfalls.
    const since = minusDays(state?.plaid_max ?? date, 30);
    const { accounts, transactions } = await pullPlaidTransactions(since, date, plaidOptions);
    let liabilities: Awaited<ReturnType<typeof pullPlaidLiabilities>> | undefined;
    const liabilities_skipped: Array<{ institution: string; error: string }> = [];
    try {
      liabilities = await pullPlaidLiabilities(plaidOptions);
    } catch (error) {
      if (!(error instanceof WealthProviderError || error instanceof z.ZodError)) throw error;
      liabilities_skipped.push({
        institution: 'Plaid',
        error:
          error instanceof WealthProviderError ? error.message : 'invalid liabilities response',
      });
    }
    input.plaid = {
      accounts,
      transactions,
      transactions_since: since,
      ...(liabilities ? { liabilities } : {}),
      ...(liabilities_skipped.length ? { liabilities_skipped } : {}),
    };
  }
  if (process.env.STARLING_API_TOKEN) {
    // A superset of the checked window; the service trims it to the reconciliation dates.
    const until = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const { feeds } = await pullStarlingFeeds(
      minusDays(state?.starling_max ?? date, 8),
      until,
      starlingConfig(),
    );
    input.starling = { feeds };
  }
  const result = envelopeSchema.parse(await hominem.call('finance_wealth_integrity', input));
  await logRun(userKey, { run_id: Number(input.run_id), ok: result.ok, routine: 'integrity' });
  console.log(JSON.stringify(result, null, 1));
  return result.ok ? 0 : 1;
}
