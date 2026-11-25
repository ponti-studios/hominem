/**
 * Starling connector for the Hominem CLI.
 *
 * This is the standalone interface for the Starling client ported from
 * custom.legacy-starling. It deliberately delegates account, transaction,
 * balance, and savings-goal reads to starling.ts so every routine has one
 * implementation and one audit path.
 */
import { finishRun, logRun } from '../../log/agent_log.ts';
import { starlingAccounts, starlingBalances, starlingPull } from './client.ts';

function usage(): void {
  process.stderr.write(
    'Usage:\n' +
      '  hominem starling accounts\n' +
      '  hominem starling balances\n' +
      '  hominem starling transactions [--days N] [--since YYYY-MM-DD] [--until YYYY-MM-DD]\n',
  );
}

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isoMinusDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function today(): string {
  return process.env.WEALTH_SYNC_TODAY ?? new Date().toISOString().slice(0, 10);
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const action = argv[0];
  if (!action || !['accounts', 'balances', 'transactions'].includes(action)) {
    usage();
    return 2;
  }

  const dbPath = process.env.HOMINEM_AGENT_DB;
  const runId = logRun('starling-connector', {
    status: 'invoked',
    context: { action },
    path: dbPath,
  });

  try {
    if (action === 'accounts') {
      const accounts = await starlingAccounts({ dbPath });
      finishRun(runId, {
        status: 'ok',
        exitCode: 0,
        message: `${accounts.length} account(s)`,
        path: dbPath,
      });
      process.stdout.write(`${JSON.stringify({ ok: true, data: accounts }, null, 2)}\n`);
      return 0;
    }

    if (action === 'balances') {
      const result = await starlingBalances({ dbPath });
      finishRun(runId, {
        status: 'ok',
        exitCode: 0,
        message: `${result.accounts.length} account(s), ${result.notes.length} note(s)`,
        path: dbPath,
      });
      process.stdout.write(
        `${JSON.stringify({ ok: true, data: result.accounts, notes: result.notes }, null, 2)}\n`,
      );
      return 0;
    }

    const until = option(argv, '--until') ?? today();
    const since =
      option(argv, '--since') ?? isoMinusDays(until, Number(option(argv, '--days') ?? '90'));
    if (!isDate(since) || !isDate(until)) {
      throw new Error('since and until must use YYYY-MM-DD');
    }

    const result = await starlingPull(since, until, { dbPath });
    finishRun(runId, {
      status: 'ok',
      exitCode: 0,
      message: `${result.items.length} item(s), ${result.notes.length} note(s)`,
      path: dbPath,
    });
    process.stdout.write(
      `${JSON.stringify({ ok: true, data: result.items, notes: result.notes }, null, 2)}\n`,
    );
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishRun(runId, {
      status: 'failed',
      exitCode: 1,
      message: message.slice(0, 500),
      path: dbPath,
    });
    process.stderr.write(`starling: ${message}\n`);
    return 1;
  }
}
