#!/usr/bin/env node
/**
 * Live Starling balance check — "what have I got right now", straight
 * from the bank. The one wealth routine that touches no Hominem and
 * no sync state: a read-only peek at every account's /balance plus
 * its Spaces (savings goals), the live answer between syncs.
 *
 * Starling keeps the main balance in the account's default category
 * and Spaces in their own categories, so each account shows both and
 * every total line is labeled for exactly what it adds up — never a
 * guessed grand total.
 *
 * Laws, as ever: one events row per HTTP call, one runs row for the
 * routine (law 1); the token resolves from the env and is never echoed
 * (law 4) — STARLING_API_TOKEN, optional STARLING_API_BASE. Prints
 * human-readable text, exit 0, with any per-account gaps as named
 * notes. A failed backbone call prints {ok: false, error} and exits 1
 * — never a half-empty answer presented as complete.
 */
import { finishRun, logRun } from '../../log/agent_log.ts';
import { applyEnvDefaults } from './env.ts';
import { starlingBalances, type StarlingBalance } from './starling.ts';

const SYMBOLS: Record<string, string> = { GBP: '£', USD: '$' };

/** Family money format: £1,234.56 / -$12.00 / EUR for the unknowns. */
function fmtMoney(currency: string, x: number): string {
  const sym = SYMBOLS[currency] ?? `${currency} `;
  const abs = Math.abs(x).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return x < 0 ? `-${sym}${abs}` : `${sym}${abs}`;
}

function label(s: string): string {
  return s.padEnd(18);
}

function render(accts: StarlingBalance[], at: string): string {
  const out = [`Starling balances — ${at}`];
  const totals = new Map<string, number>();
  if (accts.length === 0) {
    out.push('', 'No balances to report.');
  }
  for (const a of accts) {
    const spacesTotal = a.spaces.reduce((s, sp) => s + sp.saved, 0);
    totals.set(a.currency, (totals.get(a.currency) ?? 0) + a.cleared + spacesTotal);
    out.push('', `${a.name} (${a.currency})`);
    out.push(`  ${label('Cleared:')}${fmtMoney(a.currency, a.cleared)}`);
    out.push(`  ${label('Effective:')}${fmtMoney(a.currency, a.effective)}`);
    out.push(`  ${label('Pending:')}${fmtMoney(a.currency, a.pending)}`);
    out.push(`  ${label('Overdraft limit:')}${fmtMoney(a.currency, a.overdraft)}`);
    if (a.spaces.length > 0) {
      out.push('  Spaces:');
      for (const sp of a.spaces) {
        const target = sp.target === null ? '' : ` (target ${fmtMoney(a.currency, sp.target)})`;
        out.push(`    ${sp.name.padEnd(16)}  ${fmtMoney(a.currency, sp.saved)}${target}`);
      }
    }
    out.push(`  ${label('Cleared + Spaces:')}${fmtMoney(a.currency, a.cleared + spacesTotal)}`);
  }
  if (totals.size > 0) {
    out.push('', 'All accounts, cleared + Spaces:');
    for (const [cur, total] of [...totals].sort()) {
      out.push(`  ${cur}: ${fmtMoney(cur, total)}`);
    }
  }
  return out.join('\n');
}

export async function main(): Promise<number> {
  applyEnvDefaults();
  const dbPath = process.env.HOMINEM_AGENT_DB; // undefined = the default audit db
  const runId = logRun('wealth-balances', {
    status: 'invoked',
    context: { at: new Date().toISOString() },
    path: dbPath,
  });
  try {
    const { accounts, notes } = await starlingBalances({ dbPath });
    let text = render(accounts, new Date().toISOString());
    if (notes.length > 0) {
      text += '\n\nNotes:\n' + notes.map((n) => `  - ${n}`).join('\n');
    }
    finishRun(runId, {
      status: 'ok',
      exitCode: 0,
      message: `${accounts.length} account(s), ${notes.length} note(s)`,
      path: dbPath,
    });
    process.stdout.write(text + '\n');
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
