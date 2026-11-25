/**
 * Hominem MCP client over its HTTP endpoint (POST JSON-RPC 2.0). The
 * archived sync shelled out to the ponti_log wrapper, whose bundled MCP
 * client held the auth; the port surfaces it (law 4): HOMINEM_MCP_URL +
 * HOMINEM_MCP_TOKEN, where the token is a personal `hmt_` token that
 * bypasses OAuth straight to the owner's scopes (services/api
 * mcp/routes.ts). Responses are plain JSON; the client advertises both
 * accept types and tolerates a session header if one is returned.
 *
 * Semantics pinned by the archived crown jewel and the server's schemas:
 *   - import: mode 'append' (natural-key upsert, idempotent), max 1000
 *     rows per call — the port chunks. `multiCurrencyAccounts` is gone:
 *     the current import schema has no such field (currency validation
 *     is account-scoped via allowedCurrencies), so it is not sent.
 *   - search read model returns decimal `amount`, not amountCents.
 *   - upsert REPLACES the row: any field not sent is reset (B15,
 *     verified 2026-10-15) — full-row resend is mandatory, and the
 *     linker below always sends every field.
 *   - pending rows are rejected loudly (pending_row) — never import one.
 *
 * Every tools/call lands one `events` row in the audit db (law 1). The
 * token itself is never logged.
 */
import { logEvent } from '../../log/agent_log.ts';
import { requireEnv } from './env.ts';
import type { HominemAccount, SyncDoctrine } from './types.ts';

const PROTOCOL_VERSION = '2025-06-18';

export interface HominemConfig {
  url?: string;
  token?: string;
  dbPath?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface McpResponse {
  error?: unknown;
  result?: {
    protocolVersion?: unknown;
    isError?: boolean;
    content?: Array<{ text?: unknown }>;
    structuredContent?: unknown;
  };
}

export interface ImportRejection {
  index: number;
  reason: string;
  key?: string;
}

export interface ImportTotals {
  received: number;
  upserted: number;
  created: number;
  updated: number;
  rejected: ImportRejection[];
  accountsAutoProvisioned: string[];
}

export interface AccountsListResult {
  accounts: HominemAccount[];
  count: number;
  /** Total visible accounts before the tool's 50-account result cap. */
  totalCount: number;
}

export interface DoctrineResult {
  fingerprint: string | null;
  updatedAt: string | null;
  /** Null when no doctrine is stored yet — the caller warns, never guesses. */
  doctrine: SyncDoctrine | null;
}

/** finance_doctrine_import: full replace, idempotent by server-side fingerprint. */
export interface DoctrineImportResult {
  fingerprint: string;
  status: 'created' | 'replaced' | 'unchanged';
  updatedAt: string | null;
  dryRun: boolean;
  ruleCounts: {
    merchantRules: number;
    tagRules: number;
    amountRules: number;
    transferMerchants: number;
    incomePatterns: number;
    coffeePatterns: number;
    lenses: number;
  };
}

/** finance_account_create: idempotent create-or-get, identity-matched. */
export interface AccountCreateInput {
  name: string;
  currencyCode: string;
  allowedCurrencies?: string[];
  institution?: string;
  accountNumber?: string;
  provider?: string;
  providerAccountId?: string;
  status?: 'open' | 'closed';
  accountType?: string;
  includeInNetWorth?: boolean;
}

/** finance_account_create row — the stored values, not the requested ones. */
export interface AccountCreateResult {
  /** Null only on a dry run that would create. */
  id: string | null;
  name: string;
  currencyCode: string;
  allowedCurrencies: string[];
  status: string;
  includeInNetWorth: boolean;
  provider: string | null;
  providerAccountId: string | null;
  created: boolean;
  dryRun: boolean;
}

/** finance_account_summary: per-account ledger totals + posted bounds. */
export interface AccountSummaryEntry {
  accountId: string;
  accountName: string;
  allowedCurrencies: string[];
  status: string;
  transactionCount: number;
  excludedCount: number;
  /** Decimal sums per currency over every non-excluded row. */
  totals: { currencyCode: string; sum: number }[];
  minPostedOn: string | null;
  maxPostedOn: string | null;
}

export interface AccountSummaryResult {
  accounts: AccountSummaryEntry[];
  count: number;
  totalCount: number;
}

/** finance_net_worth: labelled balance anchors as filed. */
export interface NetWorthAccount {
  accountId: string;
  name: string;
  institution: string | null;
  accountType: string;
  currencyCode: string;
  balance: number;
  balanceAsOf: string | null;
}

export interface NetWorthResult {
  asOf: string;
  totals: { currencyCode: string; total: number; accountCount: number }[];
  accounts: NetWorthAccount[];
  warnings: string[];
}

/** finance_transaction_search row (the read model — decimal amounts). */
export interface HominemSearchRow {
  id: string;
  accountId: string;
  accountName: string;
  postedOn: string;
  description: string | null;
  merchantName: string | null;
  amount: number;
  currencyCode: string;
  transactionType: string;
  categoryId: string | null;
  categoryName: string | null;
  tags: string[];
  notes: string | null;
  orderNumber: string | null;
  source: string | null;
  recurring: boolean;
  pending: boolean;
  excluded: boolean;
  counterpartId: string | null;
}

export interface SearchTransactionsInput {
  query?: string;
  from?: string;
  to?: string;
  accountId?: string;
  /** Exact tag name, matched case-insensitively (schema: tagField). */
  tag?: string;
  categoryName?: string;
  transactionType?: 'adjustment' | 'debit' | 'credit' | 'transfer';
  limit?: number;
  offset?: number;
}

export interface SearchTransactionsResult {
  transactions: HominemSearchRow[];
  count: number;
  filteredCount: number;
  totalUserCount: number;
}

/** finance_spending_by_category row — the report the brief reconciles to. */
export interface SpendingCategoryRow {
  categoryId: string;
  categoryName: string;
  currencyCode: string;
  spent: number;
  transactionCount: number;
}

export interface SpendingByCategoryInput {
  from?: string;
  to?: string;
  limit?: number;
}

export interface SpendingByCategoryResult {
  from: string;
  to: string;
  currencyCode: string | null;
  truncated: boolean;
  categories: SpendingCategoryRow[];
  warnings: string[];
}

/** finance_budget_list stored row (amounts are primary-currency cents). */
export interface BudgetStoredRow {
  id: string;
  categoryId: string;
  categoryName: string;
  tagId: string | null;
  tagName: string | null;
  amountCents: number;
  cadence: 'weekly' | 'monthly' | 'quarterly' | 'annual';
}

export interface BudgetBreachRow {
  categoryId: string;
  categoryName: string;
  overByCents: number;
}

/**
 * finance_budget_list `budgets` status row — the read subset the close
 * uses (pace/spent fields omitted; the server's schema is the owner).
 * The array carries category rows (tagId null, tagBudgets nested) and
 * tag rows (tagId set, tagBudgets empty) — composition lives on the
 * category row.
 */
export interface BudgetStatusRow {
  id: string;
  categoryId: string;
  categoryName: string;
  tagId: string | null;
  tagName: string | null;
  amountCents: number;
  cadence: string;
  currencyCode: string;
  tagBudgets?: {
    budgetId: string;
    tagId: string;
    tagName: string;
    amountCents: number;
    cadence: string;
  }[];
}

export interface BudgetListResult {
  primaryCurrency: string | null;
  /** Status rows (computed periods + nested tagBudgets), every cadence. */
  budgets: BudgetStatusRow[];
  breaches: BudgetBreachRow[];
  count: number;
  warning: string | null;
  storedBudgets: BudgetStoredRow[];
}

/**
 * Pay-as-you-go derivation on a top-up bill (computed at read time);
 * null on bills that are not top-up.
 */
export interface HominemBillPayg {
  latestBalanceCents: number;
  latestCheckedAt: string;
  supplyStatus: string;
  meterReadingKwh: number | null;
  dailyBurnCents: number | null;
  daysRemaining: number | null;
  estimatedRunOutDate: string | null;
  isStale: boolean;
  isLow: boolean;
}

/** finance_bill_list row (nextDueDate/lastPaid computed at read time). */
export interface HominemBillRow {
  id: string;
  name: string;
  providerName: string | null;
  kind: string;
  amountModel: string;
  expectedAmountCents: number | null;
  currencyCode: string;
  cadence: string | null;
  dueDay: number | null;
  /** Stored due date of a one_off bill; null on cadenced bills. */
  dueDate: string | null;
  status: string;
  type: string;
  isDismissed: boolean;
  merchantMatch: string[];
  nextDueDate: string | null;
  lastPaid: {
    transactionId: string;
    postedOn: string;
    amount: number;
    currencyCode: string;
  } | null;
  payg: HominemBillPayg | null;
  createdAt: string;
}

export interface BillListResult {
  bills: HominemBillRow[];
  count: number;
}

/** finance_runway monthlyBudgets row: a flat per-category cap in cents. */
export interface RunwayMonthlyBudget {
  category: string;
  amountCents: number;
  note?: string;
}

export interface RunwayWeekRow {
  week: number;
  weekStart: string;
  weekEnd: string;
  beginningCash: number;
  recurringOutflows: number;
  variableAllowance: number;
  netChange: number;
  endingCash: number;
}

/**
 * finance_runway output. The tool accepts no currency or account-set
 * parameter: startingCash and the weekly projection are denominated in
 * the user-selected forecast currency server-side (currencyCode), so a
 * run against an unset selection returns zeros with warnings.
 */
export interface RunwayResult {
  asOfDate: string;
  liquidAccounts: { accountName: string; balance: number }[];
  currencyCode: string | null;
  warnings: string[];
  startingCash: number;
  weeklyRecurringOutflow: number;
  recurringLookbackMonths: number;
  recurringTxnCount: number;
  weeklyVariableAllowance: number;
  weeks: RunwayWeekRow[];
}

export interface RunwayInput {
  asOf?: string;
  projectionWeeks?: number;
  monthlyBudgets?: RunwayMonthlyBudget[];
}

/** finance_monthly_stats per-currency row (transfer-inclusive by design). */
export interface MonthlyStatsBreakdown {
  currencyCode: string;
  income: number;
  expenses: number;
  net: number;
  transactionCount: number;
  averageTransaction: number;
  topTag: string;
  topMerchant: string;
  tagSpending: { name: string; amount: number }[];
}

export interface MonthlyStatsResult {
  month: string;
  income: number | null;
  expenses: number | null;
  net: number | null;
  transactionCount: number;
  averageTransaction: number | null;
  topTag: string | null;
  topMerchant: string | null;
  tagSpending: { name: string; amount: number; currencyCode: string }[];
  currencyBreakdown: MonthlyStatsBreakdown[];
  startDate?: string;
  endDate?: string;
  currencyCode: string | null;
  warnings: string[];
}

export interface TagBreakdownInput {
  from?: string;
  to?: string;
  accountId?: string;
  tag?: string;
  limit?: number;
}

/** finance_tag_breakdown output (totalsByCurrency is what the close reads). */
export interface TagBreakdownResult {
  breakdown: {
    tag: string;
    amount: number;
    percentage: number;
    transactionCount: number;
    currencyCode: string;
  }[];
  totalSpending: number | null;
  totalsByCurrency: { currencyCode: string; totalSpending: number; averagePerDay: number }[];
  averagePerDay: number | null;
  currencyCode: string | null;
  warnings: string[];
}

export class HominemMcpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HominemMcpError';
  }
}

/** One imported transaction, the write-model DTO (finance.schema.ts:1043). */
export interface HominemTxn {
  postedOn: string;
  account: string; // sheet label or account UUID
  description: string;
  amountCents: number;
  currencyCode: string;
  category?: string;
  tags?: string[];
  notes?: string;
  orderNumber?: string;
  externalId?: string;
  source?: string;
  excluded?: boolean;
  recurring?: boolean;
  transactionType?: 'adjustment' | 'debit' | 'credit' | 'transfer';
  pending?: boolean;
  counterpartId?: string;
  settledAmountCents?: number;
  settledCurrencyCode?: string;
}

const IMPORT_MAX_ROWS = 1000;

export class HominemMcp {
  private cfg: HominemConfig;
  private url: string;
  private token: string;
  private sessionId: string | null = null;
  private nextId = 1;
  private initialized = false;

  // No parameter properties: Node's strip-only TS runner rejects them.
  constructor(cfg: HominemConfig = {}) {
    this.cfg = cfg;
    this.url = cfg.url ?? requireEnv('HOMINEM_MCP_URL');
    this.token = cfg.token ?? requireEnv('HOMINEM_MCP_TOKEN');
  }

  /** POST one JSON-RPC body; return the parsed response. */
  private async post(
    body: unknown,
  ): Promise<{ status: number; json: McpResponse | null; headers: Headers }> {
    const tsRequest = new Date().toISOString();
    const tsRequestMs = Date.now();
    const method = (body as { method?: string }).method ?? '?';
    const tool =
      ((body as { params?: { name?: string } }).params?.name as string | undefined) ?? undefined;
    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${this.token}`,
      };
      if (this.sessionId) headers['mcp-session-id'] = this.sessionId;
      const resp = await (this.cfg.fetchImpl ?? fetch)(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 300_000),
      });
      const sessionHeader = resp.headers.get('mcp-session-id');
      if (sessionHeader) this.sessionId = sessionHeader;
      const contentType = resp.headers.get('content-type') ?? '';
      let json: McpResponse | null = null;
      if (contentType.includes('text/event-stream')) {
        const text = await resp.text();
        const data = text
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('');
        json = data ? (JSON.parse(data) as McpResponse) : null;
      } else {
        const text = await resp.text();
        json = text ? (JSON.parse(text) as McpResponse) : null;
      }
      logEvent('hominem-mcp', [method + (tool ? ` ${tool}` : '')], {
        tsRequest,
        tsRequestMs,
        tsResponse: new Date().toISOString(),
        tsResponseMs: Date.now(),
        httpStatus: resp.status,
        ok: resp.ok,
        params: tool,
        jsonBody: (body as { params?: unknown }).params,
        response: json?.result?.structuredContent ?? json,
        path: this.cfg.dbPath,
      });
      return { status: resp.status, json, headers: resp.headers };
    } catch (err) {
      logEvent('hominem-mcp', [method + (tool ? ` ${tool}` : '')], {
        tsRequest,
        tsRequestMs,
        tsResponse: new Date().toISOString(),
        tsResponseMs: Date.now(),
        ok: false,
        isError: true,
        error: (err as Error).message,
        path: this.cfg.dbPath,
      });
      throw err;
    }
  }

  /** initialize → notifications/initialized, once; captures the session id. */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    const init = await this.post({
      jsonrpc: '2.0',
      id: this.nextId++,
      method: 'initialize',
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'hominem-wealth-sync', version: '1.0.0' },
      },
    });
    if (init.status >= 400 || init.json?.error) {
      throw new HominemMcpError(
        `hominem initialize failed: HTTP ${init.status} ${JSON.stringify(init.json?.error ?? init.json).slice(0, 200)}`,
      );
    }
    const version = init.json?.result?.protocolVersion;
    if (version && version !== PROTOCOL_VERSION) {
      // Server negotiates its own version; log-visible, not fatal.
      process.stderr.write(`hominem negotiated protocol ${version}\n`);
    }
    // Notifications get no response body — 202 accepted.
    await this.post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    this.initialized = true;
  }

  /** One tools/call; returns structuredContent; throws on isError. */
  async call<T = Record<string, unknown>>(tool: string, args: Record<string, unknown>): Promise<T> {
    await this.ensureInitialized();
    const { json } = await this.post({
      jsonrpc: '2.0',
      id: this.nextId++,
      method: 'tools/call',
      params: { name: tool, arguments: args },
    });
    if (json?.error) {
      throw new HominemMcpError(`${tool} rpc error: ${JSON.stringify(json.error).slice(0, 300)}`);
    }
    const result = json?.result;
    if (!result)
      throw new HominemMcpError(
        `${tool} returned no result: ${JSON.stringify(json).slice(0, 300)}`,
      );
    if (result.isError) {
      const text = (result.content ?? [{}])[0]?.text ?? '';
      throw new HominemMcpError(`${tool} returned an error: ${String(text).slice(0, 300)}`);
    }
    const sc = result.structuredContent;
    if (sc === undefined || sc === null) {
      // The archived sync treated missing structuredContent as failure.
      throw new HominemMcpError(`${tool} failed: ${JSON.stringify(result).slice(0, 300)}`);
    }
    return sc as T;
  }

  /**
   * finance_accounts — the routing registry: display name plus provider
   * identity (provider, providerAccountId, accountNumber/mask). Open
   * accounts only; closed ones receive no rows.
   */
  async listFinanceAccounts(): Promise<AccountsListResult> {
    const res = await this.call<AccountsListResult>('finance_accounts', { includeClosed: false });
    return {
      accounts: res.accounts ?? [],
      count: res.count ?? (res.accounts ?? []).length,
      totalCount: res.totalCount ?? (res.accounts ?? []).length,
    };
  }

  /**
   * finance_doctrine_get — the ingest doctrine (ordered rules, each
   * with its dated-ruling provenance), or null when none is stored.
   */
  async getFinanceDoctrine(): Promise<DoctrineResult> {
    return await this.call<DoctrineResult>('finance_doctrine_get', {});
  }

  /**
   * finance_doctrine_import — the seed's doctrine leg: full replace,
   * no merge, idempotent (an identical fingerprint is a no-op and the
   * server says so with status "unchanged").
   */
  async importFinanceDoctrine(doctrine: SyncDoctrine): Promise<DoctrineImportResult> {
    return await this.call<DoctrineImportResult>('finance_doctrine_import', { doctrine });
  }

  /**
   * finance_account_create — idempotent create-or-get: matches by
   * (provider, providerAccountId) when both are given, else by
   * case-insensitive name. The registry the sync routes by.
   */
  async createFinanceAccount(input: AccountCreateInput): Promise<AccountCreateResult> {
    const args: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) args[k] = v;
    }
    return await this.call<AccountCreateResult>('finance_account_create', args);
  }

  /**
   * finance_account_summary — per-account ledger totals + posted bounds.
   * Reconciliation must see everything, so closed accounts stay in
   * (the schema's own default).
   */
  async accountSummary(): Promise<AccountSummaryResult> {
    const res = await this.call<AccountSummaryResult>('finance_account_summary', {});
    return {
      accounts: res.accounts ?? [],
      count: res.count ?? (res.accounts ?? []).length,
      totalCount: res.totalCount ?? (res.accounts ?? []).length,
    };
  }

  /**
   * finance_net_worth — the labelled balance anchors as filed. The
   * anchors are stated, never implied: Hominem keeps no snapshots.
   */
  async netWorth(): Promise<NetWorthResult> {
    const res = await this.call<NetWorthResult>('finance_net_worth', {});
    return {
      asOf: res.asOf ?? '',
      totals: res.totals ?? [],
      accounts: res.accounts ?? [],
      warnings: res.warnings ?? [],
    };
  }

  /**
   * finance_transaction_search — the read model (decimal amounts,
   * limit ≤50). Callers page or split windows themselves.
   */
  async searchTransactions(input: SearchTransactionsInput): Promise<SearchTransactionsResult> {
    const args: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) args[k] = v;
    }
    const res = await this.call<SearchTransactionsResult>('finance_transaction_search', args);
    return {
      transactions: res.transactions ?? [],
      count: res.count ?? 0,
      filteredCount: res.filteredCount ?? 0,
      totalUserCount: res.totalUserCount ?? 0,
    };
  }

  /**
   * finance_spending_by_category — the category totals the brief's
   * month-to-date figures come from, so pacing reconciles to Hominem's
   * own report by construction (no second, row-summed MTD anywhere).
   */
  async spendingByCategory(input: SpendingByCategoryInput): Promise<SpendingByCategoryResult> {
    const args: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) args[k] = v;
    }
    const res = await this.call<SpendingByCategoryResult>('finance_spending_by_category', args);
    return {
      from: res.from ?? '',
      to: res.to ?? '',
      currencyCode: res.currencyCode ?? null,
      truncated: res.truncated ?? false,
      categories: res.categories ?? [],
      warnings: res.warnings ?? [],
    };
  }

  /**
   * finance_budget_list — budgets as Hominem data: stored category and
   * tag budget rows, the server-computed breach list (any cadence),
   * and the primary currency every budget is denominated in.
   */
  async budgetList(): Promise<BudgetListResult> {
    const res = await this.call<BudgetListResult>('finance_budget_list', {});
    return {
      primaryCurrency: res.primaryCurrency ?? null,
      budgets: res.budgets ?? [],
      breaches: res.breaches ?? [],
      count: res.count ?? 0,
      warning: res.warning ?? null,
      storedBudgets: res.storedBudgets ?? [],
    };
  }

  /** finance_bill_list — the registered bills with read-time due/last-paid. */
  async billList(): Promise<BillListResult> {
    const res = await this.call<BillListResult>('finance_bill_list', {});
    return { bills: res.bills ?? [], count: res.count ?? (res.bills ?? []).length };
  }

  /**
   * finance_runway — the server's own weekly projection. Called once
   * with the only real parameters it accepts; the raw output is the
   * caller's to record verbatim, reconciled against its own liquid
   * balances (the tool takes no currency or account-set parameter).
   */
  async runway(input: RunwayInput): Promise<RunwayResult> {
    const args: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) args[k] = v;
    }
    return await this.call<RunwayResult>('finance_runway', args);
  }

  /**
   * finance_monthly_stats — the month's own totals. Transfer-inclusive
   * BY DESIGN (the server counts every row), so the close reports the
   * difference against its own income/spend headline instead of
   * reconciling it away.
   */
  async monthlyStats(month?: string): Promise<MonthlyStatsResult> {
    const args: Record<string, unknown> = {};
    if (month !== undefined) args.month = month;
    const res = await this.call<MonthlyStatsResult>('finance_monthly_stats', args);
    return { ...res, currencyBreakdown: res.currencyBreakdown ?? [], warnings: res.warnings ?? [] };
  }

  /** finance_tag_breakdown — totals per currency for one tag window. */
  async tagBreakdown(input: TagBreakdownInput): Promise<TagBreakdownResult> {
    const args: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) args[k] = v;
    }
    const res = await this.call<TagBreakdownResult>('finance_tag_breakdown', args);
    return {
      breakdown: res.breakdown ?? [],
      totalSpending: res.totalSpending ?? null,
      totalsByCurrency: res.totalsByCurrency ?? [],
      averagePerDay: res.averagePerDay ?? null,
      currencyCode: res.currencyCode ?? null,
      warnings: res.warnings ?? [],
    };
  }

  /**
   * finance_transactions_import, mode append. Natural-key upsert on the
   * server makes re-sending a window idempotent. Any rejected row is
   * surfaced to the caller, which fails the run loudly (the archived
   * contract: rejected rows are never silently dropped).
   */
  async importTransactions(txns: HominemTxn[]): Promise<ImportTotals> {
    const totals: ImportTotals = {
      received: 0,
      upserted: 0,
      created: 0,
      updated: 0,
      rejected: [],
      accountsAutoProvisioned: [],
    };
    for (let i = 0; i < txns.length; i += IMPORT_MAX_ROWS) {
      const chunk = txns.slice(i, i + IMPORT_MAX_ROWS);
      const res = await this.call<Partial<ImportTotals>>('finance_transactions_import', {
        transactions: chunk,
        mode: 'append',
        dryRun: false,
      });
      totals.received += res.received ?? 0;
      totals.upserted += res.upserted ?? 0;
      totals.created += res.created ?? 0;
      totals.updated += res.updated ?? 0;
      totals.rejected.push(...(res.rejected ?? []));
      totals.accountsAutoProvisioned.push(...(res.accountsAutoProvisioned ?? []));
    }
    return totals;
  }
}
