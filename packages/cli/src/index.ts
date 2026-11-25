#!/usr/bin/env bun
import { z } from 'zod';

import { checkAuth, googleAuth } from './auth.js';
import { GoogleAuthError } from './google.js';
import { hominemAuth } from './hominem-auth.js';
import { installAgent, uninstallAgent } from './launchd.js';
import { syncRclone } from './system.js';
import { applyEnvDefaults } from './wealth-env.js';
import {
  balances,
  brief,
  close,
  integrity,
  look,
  seed,
  sync,
  wealthErrorMessage,
} from './wealth.js';

const USAGE = `hominem — Hominem CLI

  hominem auth google          Sign in to Google (opens browser) and sync rclone
  hominem auth hominem         Sign in to Hominem with OAuth
  hominem auth check [--notify]  Live token check; exit 0 healthy, 1 dead, 2 couldn't check
  hominem auth sync-rclone     Copy the current token into the rclone remote
  hominem agent install        Install the daily 9:00 auth check (launchd)
  hominem agent uninstall      Remove the daily auth check
  hominem wealth sync [--from YYYY-MM-DD] [--until YYYY-MM-DD] [--dry-run]
  hominem wealth seed           Seed Starling accounts and optional doctrine
  hominem wealth balances       Show live Starling balances
  hominem wealth brief          Morning brief (bill snapshot kept locally)
  hominem wealth look           Forward look with a live USD-to-GBP rate
  hominem wealth close          Monthly close markdown (WEALTH_CLOSE_MONTH, WEALTH_CLOSE_OUT)
  hominem wealth integrity      Ledger integrity against live Plaid and Starling feeds
`;

async function main(argv: string[]): Promise<number> {
  const [group, command, ...flags] = argv;
  const key = `${group ?? ''} ${command ?? ''}`.trim();

  switch (key) {
    case 'auth google':
      await googleAuth();
      return 0;
    case 'auth hominem':
      await applyEnvDefaults();
      await hominemAuth();
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

const FAILURES: Record<GoogleAuthError['code'], string> = {
  TOKEN_MISSING: 'hominem: no Google token or client secret found. Run `hominem auth google`.',
  TOKEN_REVOKED: 'hominem: Google revoked the token. Run `hominem auth google`.',
  REFRESH_FAILED: 'hominem: could not refresh the Google token. Run `hominem auth google`.',
  API_UNAUTHORIZED: 'hominem: Google rejected the token. Run `hominem auth google`.',
  API_FAILED: 'hominem: the Google API call failed. Try again later.',
  NETWORK: 'hominem: could not reach Google. Check your connection.',
};

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if (process.argv[2] === 'wealth') {
    const message = wealthErrorMessage(error);
    const invalid =
      error instanceof z.ZodError
        ? `Invalid data at ${error.issues[0]?.path.join('.') || 'root'}.`
        : null;
    console.log(
      JSON.stringify({ ok: false, error: message ?? invalid ?? 'Unexpected wealth error.' }),
    );
    process.exitCode = 1;
  } else {
    // Print fixed text keyed by error code, never the raw message, so nothing user-supplied reaches the log.
    console.error(
      error instanceof GoogleAuthError
        ? FAILURES[error.code]
        : (wealthErrorMessage(error) ?? 'hominem: unexpected error'),
    );
    process.exitCode = 1;
  }
}
