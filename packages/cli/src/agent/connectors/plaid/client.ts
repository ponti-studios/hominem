/**
 * Native Plaid REST client.
 *
 * Plaid is INGEST ONLY (Charlie 2026-11-06): this client feeds transactions
 * into Hominem and never acts as a source for financial analysis. Credentials
 * and access tokens resolve from the machine environment and are never
 * written to audit events or command output.
 */
import { readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { z } from 'zod';

import { applyEnvDefaults, envFilePath, requireEnv } from '../../../env.ts';
import { logEvent } from '../../log/agent_log.ts';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface PlaidConfig {
  dbPath?: string;
  timeoutMs?: number;
  clientId?: string;
  secret?: string;
  accessToken?: string;
  environment?: 'sandbox' | 'production';
  apiBase?: string;
  fetchImpl?: typeof fetch;
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

const linkResponseSchema = z
  .object({
    link_token: z.string(),
    expiration: z.string().optional(),
  })
  .passthrough();

const exchangeResponseSchema = z
  .object({
    access_token: z.string(),
    item_id: z.string(),
  })
  .passthrough();

function resolveConfig(cfg: PlaidConfig): Required<
  Pick<PlaidConfig, 'clientId' | 'secret' | 'environment' | 'apiBase' | 'timeoutMs'>
> & {
  accessToken?: string;
  dbPath?: string;
  fetchImpl: typeof fetch;
} {
  applyEnvDefaults();
  const environment =
    cfg.environment ?? (process.env.PLAID_ENV as PlaidConfig['environment']) ?? 'sandbox';
  if (environment !== 'sandbox' && environment !== 'production') {
    throw new Error('PLAID_ENV must be sandbox or production');
  }
  const defaultBase =
    environment === 'sandbox' ? 'https://sandbox.plaid.com' : 'https://production.plaid.com';
  return {
    clientId: cfg.clientId ?? requireEnv('PLAID_CLIENT_ID'),
    secret: cfg.secret ?? requireEnv('PLAID_SECRET'),
    environment,
    apiBase: (cfg.apiBase ?? process.env.PLAID_API_BASE ?? defaultBase).replace(/\/$/, ''),
    timeoutMs: cfg.timeoutMs ?? 300_000,
    accessToken: cfg.accessToken ?? process.env.PLAID_ACCESS_TOKEN,
    dbPath: cfg.dbPath,
    fetchImpl: cfg.fetchImpl ?? fetch,
  };
}

async function plaidPost(
  endpoint: string,
  input: Record<string, unknown>,
  cfg: PlaidConfig,
  service: string,
): Promise<Record<string, unknown>> {
  const resolved = resolveConfig(cfg);
  const body = {
    client_id: resolved.clientId,
    secret: resolved.secret,
    ...input,
  };
  const tsRequest = new Date().toISOString();
  const tsRequestMs = Date.now();
  let status = 0;
  try {
    const response = await resolved.fetchImpl(resolved.apiBase + endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(resolved.timeoutMs),
    });
    status = response.status;
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        typeof payload.error_message === 'string'
          ? payload.error_message
          : `Plaid ${endpoint} returned HTTP ${status}`,
      );
    }
    logEvent('plaid', ['POST', endpoint], {
      tsRequest,
      tsRequestMs,
      tsResponse: new Date().toISOString(),
      tsResponseMs: Date.now(),
      httpStatus: status,
      service,
      params: { environment: resolved.environment, hasAccessToken: 'access_token' in input },
      response: {
        requestId: typeof payload.request_id === 'string' ? payload.request_id : undefined,
        itemId: typeof payload.item_id === 'string' ? payload.item_id : undefined,
        accountCount: Array.isArray(payload.accounts) ? payload.accounts.length : undefined,
        transactionCount: Array.isArray(payload.transactions)
          ? payload.transactions.length
          : undefined,
        linkTokenCreated: typeof payload.link_token === 'string',
        exchangeSucceeded: typeof payload.access_token === 'string',
      },
      ok: true,
      isError: false,
      path: resolved.dbPath,
    });
    return payload;
  } catch (error) {
    logEvent('plaid', ['POST', endpoint], {
      tsRequest,
      tsRequestMs,
      tsResponse: new Date().toISOString(),
      tsResponseMs: Date.now(),
      httpStatus: status || undefined,
      service,
      params: { environment: resolved.environment, hasAccessToken: 'access_token' in input },
      ok: false,
      isError: true,
      error: { message: error instanceof Error ? error.message : String(error) },
      path: resolved.dbPath,
    });
    throw error;
  }
}

export interface PlaidSetupStatus {
  clientIdConfigured: boolean;
  secretConfigured: boolean;
  accessTokenConfigured: boolean;
  environment: 'sandbox' | 'production' | 'development' | 'invalid';
  environmentConfigured: boolean;
}

export function plaidSetupStatus(cfg: PlaidConfig = {}): PlaidSetupStatus {
  applyEnvDefaults();
  const environment =
    cfg.environment ?? (process.env.PLAID_ENV as PlaidConfig['environment']) ?? 'sandbox';
  const valid = environment === 'sandbox' || environment === 'production';
  return {
    clientIdConfigured: Boolean(cfg.clientId ?? process.env.PLAID_CLIENT_ID),
    secretConfigured: Boolean(cfg.secret ?? process.env.PLAID_SECRET),
    accessTokenConfigured: Boolean(cfg.accessToken ?? process.env.PLAID_ACCESS_TOKEN),
    environment: valid ? environment : 'invalid',
    environmentConfigured: valid,
  };
}

export async function plaidLinkTokenCreate(cfg: PlaidConfig = {}): Promise<{
  linkToken: string;
  expiration?: string;
}> {
  const payload = await plaidPost(
    '/link/token/create',
    {
      client_name: 'Hominem',
      country_codes: ['US'],
      language: 'en',
      products: ['transactions', 'liabilities'],
      user: { client_user_id: 'hominem-local' },
    },
    cfg,
    'link_token',
  );
  const parsed = linkResponseSchema.parse(payload);
  return { linkToken: parsed.link_token, expiration: parsed.expiration };
}

function replaceEnvValue(text: string, key: string, value: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const line = new RegExp(`^((?:export\\s+)?)${escaped}=.*$`, 'm');
  const replacement = `${key}=${value}`;
  if (line.test(text)) return text.replace(line, replacement);
  return `${text.trimEnd()}${text.trim().length > 0 ? '\n' : ''}${replacement}\n`;
}

export async function plaidExchangePublicToken(
  publicToken: string,
  cfg: PlaidConfig = {},
): Promise<{ accessToken: string; itemId: string }> {
  const payload = await plaidPost(
    '/item/public_token/exchange',
    { public_token: publicToken },
    cfg,
    'exchange',
  );
  const parsed = exchangeResponseSchema.parse(payload);
  const path = envFilePath();
  mkdirSync(dirname(path), { recursive: true });
  let text = '';
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  text = replaceEnvValue(text, 'PLAID_ACCESS_TOKEN', parsed.access_token);
  text = replaceEnvValue(text, 'PLAID_ITEM_ID', parsed.item_id);
  writeFileSync(path, text, { mode: 0o600 });
  chmodSync(path, 0o600);
  process.env.PLAID_ACCESS_TOKEN = parsed.access_token;
  process.env.PLAID_ITEM_ID = parsed.item_id;
  return { accessToken: parsed.access_token, itemId: parsed.item_id };
}

const accountListSchema = z
  .object({
    institutions: z
      .array(
        z
          .object({
            display_name: z.string().optional(),
            credential_id: z.string().optional(),
            read_status: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    accounts: z
      .array(
        z
          .object({
            account_id: z.string(),
            name: z.string().optional(),
            mask: z.string().nullable().optional(),
            type: z.string().optional(),
            balances: z
              .object({
                current: z.number().nullable().optional(),
                iso_currency_code: z.string().nullable().optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
    item: z.object({ item_id: z.string().optional() }).passthrough().optional(),
  })
  .passthrough();

const transactionListSchema = z
  .object({
    accounts: z
      .array(
        z
          .object({
            account_id: z.string(),
            name: z.string().optional(),
            mask: z.string().nullable().optional(),
            type: z.string().optional(),
            balances: z
              .object({
                current: z.number().nullable().optional(),
                iso_currency_code: z.string().nullable().optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
    transactions: z
      .array(
        z
          .object({
            account_id: z.string(),
            date: z.string(),
            pending: z.boolean().optional(),
            merchant_name: z.string().nullable().optional(),
            name: z.string().optional(),
            amount: z.number().optional(),
            iso_currency_code: z.string().nullable().optional(),
            unofficial_currency_code: z.string().nullable().optional(),
          })
          .passthrough(),
      )
      .optional(),
    total_transactions: z.number().optional(),
  })
  .passthrough();

const liabilitiesSchema = z
  .object({
    accounts: z
      .array(
        z
          .object({
            account_id: z.string(),
            name: z.string().optional(),
            mask: z.string().nullable().optional(),
            type: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    liabilities: z
      .object({
        credit: z
          .array(
            z
              .object({
                account_id: z.string(),
                last_statement_balance: z.number().nullable().optional(),
                last_statement_issue_date: z.string().nullable().optional(),
                last_payment_due_date: z.string().nullable().optional(),
                next_payment_due_date: z.string().nullable().optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

function requireAccessToken(cfg: PlaidConfig): string {
  return cfg.accessToken ?? requireEnv('PLAID_ACCESS_TOKEN');
}

/** `plaid accounts` — balances per account plus institutions/credentials. */
export async function plaidAccounts(cfg: PlaidConfig = {}): Promise<PlaidBody> {
  const accessToken = requireAccessToken(cfg);
  const payload = await plaidPost('/accounts/get', { access_token: accessToken }, cfg, 'accounts');
  const parsed = accountListSchema.parse(payload);
  const credentialId = process.env.PLAID_ITEM_ID;
  const institutions = (parsed.institutions ?? []).map((institution) => ({
    display_name: institution.display_name,
    credential_id: institution.credential_id,
    read_status: institution.read_status,
  }));
  return {
    institutions:
      institutions.length > 0
        ? institutions
        : credentialId
          ? [{ display_name: 'Plaid', credential_id: credentialId, read_status: 'ok' }]
          : [],
    accounts: (parsed.accounts ?? []).map((account) => ({
      account_id: account.account_id,
      name: account.name,
      mask: account.mask ?? undefined,
      type: account.type,
      balances: account.balances,
      _plaid_source: { credential_id: credentialId },
    })),
  };
}

/** `plaid liabilities --credential-id C` — card statement state per credential. */
export async function plaidLiabilities(
  credentialId: string,
  cfg: PlaidConfig = {},
): Promise<PlaidBody> {
  const accessToken = requireAccessToken(cfg);
  const payload = await plaidPost(
    '/liabilities/get',
    { access_token: accessToken },
    cfg,
    'liabilities',
  );
  const parsed = liabilitiesSchema.parse(payload);
  const credit = parsed.liabilities?.credit ?? [];
  return {
    institutions: [{ display_name: 'Plaid', credential_id: credentialId, read_status: 'ok' }],
    accounts: (parsed.accounts ?? []).map((account) => ({
      account_id: account.account_id,
      name: account.name,
      mask: account.mask ?? undefined,
      type: account.type,
    })),
    liabilities: { credit },
  };
}

/** `plaid transactions-get` over a raw window — the settled gap read (Layer 1). */
export async function plaidTransactionsWindow(
  from: string,
  to: string,
  cfg: PlaidConfig = {},
): Promise<PlaidBody> {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    throw new Error('Plaid transaction dates must use YYYY-MM-DD');
  }
  const accessToken = requireAccessToken(cfg);
  const accountsPayload = await plaidPost(
    '/accounts/get',
    { access_token: accessToken },
    cfg,
    'accounts',
  );
  const accountsParsed = accountListSchema.parse(accountsPayload);
  const credentialId = process.env.PLAID_ITEM_ID;
  const accounts = (accountsParsed.accounts ?? []).map((account) => ({
    account_id: account.account_id,
    name: account.name,
    mask: account.mask ?? undefined,
    type: account.type,
    balances: account.balances,
    _plaid_source: { credential_id: credentialId },
  }));

  const transactions: PlaidBody['transactions'] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (offset < total) {
    const payload = await plaidPost(
      '/transactions/get',
      {
        access_token: accessToken,
        start_date: from,
        end_date: to,
        options: { count: 500, offset },
      },
      cfg,
      'transactions',
    );
    const parsed = transactionListSchema.parse(payload);
    transactions?.push(
      ...(parsed.transactions ?? []).map((transaction) => ({
        account_id: transaction.account_id,
        date: transaction.date,
        pending: transaction.pending,
        merchant_name: transaction.merchant_name ?? undefined,
        name: transaction.name,
        amount: transaction.amount,
        iso_currency_code: transaction.iso_currency_code ?? undefined,
        unofficial_currency_code: transaction.unofficial_currency_code ?? undefined,
      })),
    );
    total = parsed.total_transactions ?? transactions?.length ?? 0;
    offset += parsed.transactions?.length ?? 0;
    if ((parsed.transactions?.length ?? 0) === 0) break;
  }

  return {
    institutions:
      (accountsParsed.institutions ?? []).length > 0
        ? (accountsParsed.institutions ?? []).map((institution) => ({
            display_name: institution.display_name,
            credential_id: institution.credential_id,
            read_status: institution.read_status,
          }))
        : credentialId
          ? [{ display_name: 'Plaid', credential_id: credentialId, read_status: 'ok' }]
          : [],
    accounts,
    transactions,
  };
}
