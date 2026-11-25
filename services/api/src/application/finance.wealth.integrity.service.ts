import type { FinanceAccountRoute } from '@hominem/finance-services';
import { starlingFeedsToItems } from '@hominem/finance-services/ingest';

import type {
  FinanceWealthIntegrityInput,
  FinanceWealthIntegrityOutput,
} from '../schemas/finance.wealth.schema';
import {
  createReportReads,
  isoDaysBetween,
  isoMinusDays,
  isoPlusDays,
  matchesMerchant,
  round2,
  searchAll,
  todayIso,
  type ReportReads,
} from './finance.wealth.shared';

const DRIFT_TOLERANCE = 1;
const STARLING_TOLERANCE = 0.01;

type Flag = FinanceWealthIntegrityOutput['flags'][number];
type SyncStateFile = NonNullable<FinanceWealthIntegrityInput['sync_state']>;
type Plaid = NonNullable<FinanceWealthIntegrityInput['plaid']>;
type Summary = Awaited<ReturnType<ReportReads['accountSummary']>>['accounts'][number];

type Ctx = { flags: Flag[]; info: Record<string, unknown> };

function note(
  ctx: Ctx,
  check: string,
  account: string | null,
  detail: string,
  severity: Flag['severity'] = 'flag',
) {
  ctx.flags.push({ check, account, detail, severity });
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function checkFeedHealth(ctx: Ctx, state: SyncStateFile | undefined, today: string): SyncStateFile {
  if (!state) {
    note(ctx, 'feed_health', null, 'sync state not supplied — has the sync ever run?');
    return {};
  }
  ctx.info.watermarks = state;
  for (const key of ['starling_max', 'plaid_max'] as const) {
    const watermark = state[key];
    if (!watermark) {
      note(ctx, 'feed_health', key, 'watermark missing');
      continue;
    }
    const age = isoDaysBetween(watermark, today);
    if (age > 4) {
      note(
        ctx,
        'feed_health',
        key,
        `watermark ${key} is ${age} days old (${watermark}); the sync or the feed may be stalled`,
      );
    }
  }
  return state;
}

function checkPlaidDrift(
  ctx: Ctx,
  accounts: FinanceAccountRoute[],
  summaries: Map<string, Summary>,
  plaid: Plaid | undefined,
  today: string,
) {
  if (!plaid) {
    note(ctx, 'balance_drift', null, 'skipped: Plaid feed data was not supplied', 'info');
    return;
  }
  ctx.info.plaid_accounts = plaid.accounts.length;
  if (!plaid.accounts.length) {
    note(ctx, 'balance_drift', null, 'skipped: no Plaid accounts were supplied', 'info');
  }
  const results: Record<string, number | null> = {};
  for (const feed of plaid.accounts) {
    if (!feed.mask) continue;
    const hits = accounts.filter((account) => account.accountNumber === feed.mask);
    const account = hits.length === 1 ? hits[0] : undefined;
    if (!account) continue;
    const summary = summaries.get(account.id);
    const balance = feed.balances?.current;
    if (!summary) continue;
    if (balance === null || balance === undefined) {
      note(ctx, 'balance_drift', account.name, 'skipped: Plaid balance was not supplied', 'info');
      continue;
    }
    const currency = feed.balances?.iso_currency_code;
    if (!currency) {
      note(ctx, 'balance_drift', account.name, 'skipped: Plaid balance has no currency', 'info');
      continue;
    }
    const ledgerSum = summary.totals.find((total) => total.currencyCode === currency)?.sum;
    if (ledgerSum === undefined) continue;
    const feedSigned = feed.type === 'depository' ? balance : -balance;
    if (!summary.maxPostedOn) {
      results[account.name] = null;
      continue;
    }
    const maxPosted = summary.maxPostedOn;
    if (plaid.transactions_since && maxPosted < plaid.transactions_since) {
      note(
        ctx,
        'balance_drift',
        account.name,
        `skipped: Plaid transactions start ${plaid.transactions_since}, after ledger max date ${maxPosted}`,
        'info',
      );
      results[account.name] = null;
      continue;
    }
    const gap = round2(
      plaid.transactions
        .filter(
          (transaction) =>
            transaction.account_id === feed.account_id &&
            !transaction.pending &&
            transaction.date > maxPosted &&
            transaction.date <= today,
        )
        .reduce((sum, transaction) => sum - transaction.amount, 0),
    );
    const expected = round2(feedSigned - gap);
    const residual = round2(ledgerSum - expected);
    results[account.name] = residual;
    if (Math.abs(residual) > DRIFT_TOLERANCE) {
      note(
        ctx,
        'balance_drift',
        account.name,
        `ledger sum ${ledgerSum.toFixed(2)} ${currency} vs feed-implied ${expected.toFixed(2)} ` +
          `(feed balance ${feedSigned.toFixed(2)}, gap window ${gap >= 0 ? '+' : ''}${gap.toFixed(2)}); ` +
          `unexplained residual ${residual >= 0 ? '+' : ''}${residual.toFixed(2)}`,
      );
    }
  }
  ctx.info.plaid_drift = results;
}

async function checkStarlingWindow(
  ctx: Ctx,
  reads: ReportReads,
  accounts: FinanceAccountRoute[],
  state: SyncStateFile,
  today: string,
  starling: FinanceWealthIntegrityInput['starling'],
) {
  if (!starling) {
    note(
      ctx,
      'starling_reconciliation',
      null,
      'skipped: Starling feed data was not supplied',
      'info',
    );
    return;
  }
  const starlingAccounts = accounts.filter(
    (account) => account.provider === 'starling' && account.providerAccountId,
  );
  if (!starlingAccounts.length) return;
  const from = isoMinusDays(state.starling_max ?? isoMinusDays(today, 7), 1);
  const feed = new Map<string, number>();
  for (const item of starlingFeedsToItems(starling.feeds)) {
    if (item.status !== 'SETTLED' || !item.accountUid || item.date < from || item.date > today)
      continue;
    feed.set(item.accountUid, round2((feed.get(item.accountUid) ?? 0) + item.amount));
  }
  const windows: Record<string, { from: string; feed_sum: number; ledger_sum: number }> = {};
  ctx.info.starling_window = windows;
  for (const account of starlingAccounts) {
    const feedSum = round2(feed.get(account.providerAccountId ?? '') ?? 0);
    const rows = await searchAll(reads, { accountId: account.id, from, to: today });
    const ledgerSum = round2(
      rows
        .filter((row) => row.source === 'starling' && row.currencyCode === account.currencyCode)
        .reduce((sum, row) => sum + row.amount, 0),
    );
    windows[account.name] = { from, feed_sum: feedSum, ledger_sum: ledgerSum };
    if (Math.abs(feedSum - ledgerSum) > STARLING_TOLERANCE) {
      note(
        ctx,
        'starling_reconciliation',
        account.name,
        `settled feed transactions ${from}..${today} sum to ${feedSum.toFixed(2)} ${account.currencyCode} ` +
          `but ledger rows from Starling sum to ${ledgerSum.toFixed(2)} ${account.currencyCode} ` +
          `(difference ${ledgerSum >= feedSum ? '+' : ''}${(ledgerSum - feedSum).toFixed(2)})`,
      );
    }
  }
}

async function checkAnchorFreshness(
  ctx: Ctx,
  reads: ReportReads,
  anchors: FinanceWealthIntegrityInput['manual_anchors'],
  today: string,
) {
  if (!anchors) {
    note(
      ctx,
      'anchor_freshness',
      null,
      'skipped: no manual anchor refresh thresholds supplied',
      'info',
    );
    return;
  }
  const worth = await reads.netWorth();
  const seen: Record<string, string | null> = {};
  for (const account of worth.accounts) {
    const maxAge = anchors[account.name];
    if (maxAge === undefined) continue;
    seen[account.name] = account.balanceAsOf;
    if (!account.balanceAsOf) {
      note(ctx, 'anchor_freshness', account.name, 'no balance anchor date recorded');
      continue;
    }
    const age = isoDaysBetween(account.balanceAsOf, today);
    if (age > maxAge) {
      note(
        ctx,
        'anchor_freshness',
        account.name,
        `manual anchor is ${age} days old (as of ${account.balanceAsOf}); ` +
          `balance ${account.balance} ${account.currencyCode} may have drifted — refresh from the issuer when convenient`,
      );
    }
  }
  ctx.info.manual_anchors = seen;
}

async function checkCancellationWatches(
  ctx: Ctx,
  reads: ReportReads,
  watches: FinanceWealthIntegrityInput['cancellation_watches'],
  today: string,
  sweepFrom: string | undefined,
) {
  if (!watches) return;
  const seen: Array<{ id?: string; status?: string }> = [];
  for (const watch of watches) {
    if (!(watch.status ?? '').toLowerCase().startsWith('open')) continue;
    const merchant = watch.merchant ?? '';
    const token = merchant.split(/\s+/)[0] ?? '';
    const dates = (watch.escalate_if ?? '').match(/\d{4}-\d{2}-\d{2}/g) ?? [];
    const chargeFrom = dates[0];
    const confirmBy = dates.length > 1 ? dates.at(-1) : undefined;
    if (chargeFrom && token) {
      const rows = await searchAll(reads, {
        query: token,
        from: sweepFrom ?? chargeFrom,
        to: today,
      });
      for (const row of rows) {
        if (
          !row.pending &&
          row.amount < 0 &&
          row.postedOn >= chargeFrom &&
          matchesMerchant(row, token)
        ) {
          note(
            ctx,
            'cancellation_watch',
            merchant,
            `CHARGE POSTED after cancellation: ${row.amount} ${row.currencyCode} on ${row.postedOn} ` +
              `(${row.accountName}) — watch ${watch.id}`,
          );
        }
      }
    }
    seen.push({
      ...(watch.id === undefined ? {} : { id: watch.id }),
      ...(watch.status === undefined ? {} : { status: watch.status }),
    });
    if (confirmBy && today > confirmBy) {
      note(
        ctx,
        'cancellation_watch',
        merchant,
        `no substantive confirmation recorded by ${confirmBy} (watch ${watch.id}); ` +
          `status still "${watch.status}" — check email for a confirmation before treating as escalated`,
      );
    }
  }
  if (seen.length) ctx.info.watches = seen;
}

async function checkStatementPayments(
  ctx: Ctx,
  reads: ReportReads,
  accounts: FinanceAccountRoute[],
  plaid: Plaid | undefined,
  today: string,
) {
  if (plaid?.liabilities_skipped?.length) ctx.info.liabilities_skipped = plaid.liabilities_skipped;
  if (!plaid?.liabilities) {
    note(
      ctx,
      'payment_verification',
      null,
      'skipped: Plaid liability data was not supplied',
      'info',
    );
    return;
  }
  const credit = plaid.liabilities.liabilities.credit;
  const masks = new Map(
    plaid.liabilities.accounts.map((account) => [account.account_id, account.mask]),
  );
  ctx.info.liability_cards = credit.length;
  const statements: Array<{
    account: string;
    statement: number;
    issue: string;
    due: string;
    paid_in_window: number;
  }> = [];
  for (const card of credit) {
    const mask = masks.get(card.account_id);
    if (!mask) continue;
    const hits = accounts.filter((account) => account.accountNumber === mask);
    const account = hits.length === 1 ? hits[0] : undefined;
    const statement = card.last_statement_balance;
    const issue = card.last_statement_issue_date;
    const due = card.next_payment_due_date ?? card.last_payment_due_date;
    if (!account || statement === null || statement === undefined || !issue || !due) continue;
    const graceEnd = isoPlusDays(due, 3);
    const to = graceEnd < today ? graceEnd : today;
    const rows = await searchAll(reads, { accountId: account.id, from: issue, to });
    const paid = round2(
      rows
        .filter(
          (row) =>
            row.amount > 0 &&
            !row.excluded &&
            !row.pending &&
            (row.transactionType === 'credit' || row.transactionType === 'transfer') &&
            !(row.description ?? '').toLowerCase().includes('normalization'),
        )
        .reduce((sum, row) => sum + row.amount, 0),
    );
    const short = round2(statement - paid);
    statements.push({ account: account.name, statement, issue, due, paid_in_window: paid });
    if (today > graceEnd && short > 0.01) {
      note(
        ctx,
        'payment_verification',
        account.name,
        `statement of ${statement.toFixed(2)} issued ${issue} was due ${due}; ` +
          `payments in [issue, due+3d] sum to ${paid.toFixed(2)} — short ${short.toFixed(2)}. ` +
          'Verify in the issuer app before assuming a miss.',
      );
    }
  }
  if (statements.length) ctx.info.statements = statements;
}

export async function runCheck(
  ownerUserId: string,
  input: FinanceWealthIntegrityInput,
): Promise<FinanceWealthIntegrityOutput> {
  const date = input.date ?? todayIso();
  const reads = createReportReads(ownerUserId, date);
  const ctx: Ctx = { flags: [], info: {} };
  const accounts = (await reads.listFinanceAccounts()).accounts;
  const summary = await reads.accountSummary();
  const summaries = new Map(summary.accounts.map((account) => [account.accountId, account]));
  const state = checkFeedHealth(ctx, input.sync_state, date);
  try {
    checkPlaidDrift(ctx, accounts, summaries, input.plaid, date);
  } catch (error) {
    note(ctx, 'balance_drift', null, `Plaid drift check failed: ${message(error)}`);
  }
  try {
    await checkStarlingWindow(ctx, reads, accounts, state, date, input.starling);
  } catch (error) {
    note(ctx, 'starling_reconciliation', null, `check failed: ${message(error)}`);
  }
  try {
    await checkAnchorFreshness(ctx, reads, input.manual_anchors, date);
  } catch (error) {
    note(ctx, 'anchor_freshness', null, `check failed: ${message(error)}`);
  }
  try {
    await checkCancellationWatches(ctx, reads, input.cancellation_watches, date, input.sweep_from);
  } catch (error) {
    note(ctx, 'cancellation_watch', null, `check failed: ${message(error)}`);
  }
  try {
    await checkStatementPayments(ctx, reads, accounts, input.plaid, date);
  } catch (error) {
    note(ctx, 'payment_verification', null, `check failed: ${message(error)}`);
  }
  return { ok: true, date, flags: ctx.flags, info: ctx.info, run_id: input.run_id ?? null };
}
