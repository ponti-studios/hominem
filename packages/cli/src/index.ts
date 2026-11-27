#!/usr/bin/env bun
import { parse } from '@oclif/core/parser';

import { main as analyzeCalendar } from './agent/calendar/analyze.js';
import { AGENT_COMMANDS, runAgent } from './agent/index.js';
import { checkAuth, googleAuth } from './auth.js';
import CalendarAnalyze from './commands/calendar/analyze.js';
import { describeError } from './errors.js';
import { signInWithSetup, terminalAsk } from './hominem-setup.js';
import { installAgent, uninstallAgent } from './launchd.js';
import { syncRclone } from './system.js';
import { balances, brief, close, integrity, look, seed, sync } from './wealth.js';

const WEALTH_COMMANDS = new Set([
  'sync',
  'seed',
  'balances',
  'brief',
  'look',
  'close',
  'integrity',
]);

const WEALTH_USAGE = `hominem wealth

Personal finance routines. The Hominem API does the finance work; this command
keeps provider credentials, rates, and local state on this machine.
Sign in first with \`hominem auth\`. Output is JSON, except balances (text).

Commands:
  sync [--from YYYY-MM-DD] [--until YYYY-MM-DD] [--dry-run]
                Send provider transactions to Hominem for routing and import
  seed          Seed Starling accounts and optional doctrine
  balances      Show live Starling balances
  brief         Morning brief (bill snapshot kept locally)
  look          Forward look with a live USD-to-GBP rate
  close         Monthly close markdown (WEALTH_CLOSE_MONTH, WEALTH_CLOSE_OUT)
  integrity     Ledger integrity against live Plaid and Starling feeds
`;

const USAGE = `hominem — Hominem CLI

  hominem auth google          Sign in to Google (opens browser) and sync rclone
  hominem auth                 Sign in to Hominem with OAuth
  hominem auth check [--notify]  Live token check; exit 0 healthy, 1 dead, 2 couldn't check
  hominem auth sync-rclone     Copy the current token into the rclone remote
  hominem agent install        Install the daily 9:00 auth check (launchd)
  hominem agent uninstall      Remove the daily auth check

  hominem chat "request"       Run the personal agent
  hominem remember "fact"      Save a durable memory
  hominem recall "query"       Search durable memory
  hominem reflect < transcript Extract and save durable conversation facts
  hominem cadence weekly       Regenerate an open Google Tasks cadence
  hominem finance sync [--bank starling] [--from YYYY-MM-DD] [--until YYYY-MM-DD] [--dry-run]
                               Add new bank transactions; stored ones are never rewritten
  hominem wealth sync [--from YYYY-MM-DD] [--until YYYY-MM-DD] [--dry-run]
  hominem wealth seed           Seed Starling accounts and optional doctrine
  hominem wealth balances       Show live Starling balances
  hominem wealth brief          Morning brief (bill snapshot kept locally)
  hominem wealth look           Forward look with a live USD-to-GBP rate
  hominem wealth close          Monthly close markdown (WEALTH_CLOSE_MONTH, WEALTH_CLOSE_OUT)
  hominem wealth integrity      Ledger integrity against live Plaid and Starling feeds
  hominem tasks <command...>   Google Tasks API
  hominem gws <command...>     Google Workspace connector
  hominem spotify <command...> Spotify connector
  hominem starling <command...> Starling connector
  hominem instagram <command...>
  hominem ytm <command...>
  hominem linear <command...>
  hominem notion <command...>
  hominem ponti <command...>
  hominem plaid <command...> Plaid connector
  hominem knowledge validate [batch-dir] [bodies-dir]
  hominem calendar analyze [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--no-pull] [--json]
  hominem workflow status [run-id]
  hominem studio nameplate --word WORD --font PATH --texture PATH --preset platinum|gold --output PATH
`;

async function main(argv: string[]): Promise<number> {
  if (argv[0] === 'calendar') {
    if (argv[1] === 'analyze') {
      if (argv.slice(2).includes('--help') || argv.slice(2).includes('-h')) {
        process.stdout.write(
          'hominem calendar analyze\n\n' +
            'Read-only primary-calendar analysis.\n\n' +
            'Usage:\n' +
            '  hominem calendar analyze [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--no-pull] [--json]\n\n' +
            'Options:\n' +
            '  --start YYYY-MM-DD  First local calendar date\n' +
            '  --end YYYY-MM-DD    Last local calendar date\n' +
            '  --no-pull           Reuse the cached event pull\n' +
            '  --json              Emit the machine-readable envelope\n' +
            '  --help, -h          Show this help\n',
        );
        return 0;
      }
      try {
        const parsed = await parse(argv.slice(2), {
          flags: CalendarAnalyze.flags,
          args: {},
          strict: false,
        });
        const analyzeArgs = ['analyze'];
        if (typeof parsed.flags.start === 'string') {
          analyzeArgs.push('--start', parsed.flags.start);
        }
        if (typeof parsed.flags.end === 'string') {
          analyzeArgs.push('--end', parsed.flags.end);
        }
        if (parsed.flags['no-pull'] === true) analyzeArgs.push('--no-pull');
        if (parsed.flags.json === true) analyzeArgs.push('--json');
        return await analyzeCalendar(analyzeArgs);
      } catch (error) {
        console.error(
          `hominem calendar analyze: ${error instanceof Error ? error.message : String(error)}`,
        );
        return 2;
      }
    }
    if (argv[1] === '--help' || argv[1] === '-h' || argv.length === 1) {
      process.stdout.write(
        'hominem calendar\n\n' +
          'Read-only Google Calendar analysis.\n\n' +
          'Actions:\n' +
          '  analyze  Pull or reuse primary-calendar events and write a report\n\n' +
          'Usage:\n' +
          '  hominem calendar analyze [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--no-pull] [--json]\n',
      );
      return 0;
    }
    process.stderr.write(`hominem calendar: unknown action ${argv[1]}\n`);
    return 2;
  }
  if (AGENT_COMMANDS.has(argv[0] ?? '')) return runAgent(argv);
  if (argv[0] === 'wealth' && !WEALTH_COMMANDS.has(argv[1] ?? '')) {
    const help = argv[1] === undefined || argv[1] === '--help' || argv[1] === '-h';
    if (!help) process.stderr.write(`hominem wealth: unknown command ${argv[1]}\n\n`);
    (help ? process.stdout : process.stderr).write(WEALTH_USAGE);
    return help ? 0 : 2;
  }
  const [group, command, ...flags] = argv;
  const key = `${group ?? ''} ${command ?? ''}`.trim();

  switch (key) {
    case 'auth google':
      await googleAuth();
      return 0;
    case 'auth':
      await signInWithSetup({ ask: terminalAsk() });
      return 0;
    case 'auth check':
      return checkAuth({ notify: flags.includes('--notify') });
    case 'auth sync-rclone':
      console.log(await syncRclone());
      return 0;
    case 'agent install':
      console.log(await installAgent());
      return 0;
    case 'agent uninstall':
      console.log(await uninstallAgent());
      return 0;
    case 'finance sync':
      return sync(flags, 'finance');
    case 'wealth sync':
      return sync(flags);
    case 'wealth seed':
      return seed(flags);
    case 'wealth balances':
      return balances(flags);
    case 'wealth brief':
      return brief(flags);
    case 'wealth look':
      return look(flags);
    case 'wealth close':
      return close(flags);
    case 'wealth integrity':
      return integrity(flags);
    default:
      console.log(USAGE);
      return key === '' || key === 'help' || key === '--help' ? 0 : 1;
  }
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if (process.env.HOMINEM_DEBUG) console.error(error);
  const message = describeError(error);
  if (process.argv[2] === 'wealth' || process.argv[2] === 'finance') {
    console.log(JSON.stringify({ ok: false, error: message }));
  } else {
    // Server and user text can end up in a message, so keep it to one line.
    console.error(message.replace(/[\r\n]+/g, ' '));
  }
  process.exitCode = 1;
}
