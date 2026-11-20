#!/usr/bin/env bun
import { checkAuth, googleAuth } from './auth.js';
import { GoogleAuthError } from './google.js';
import { installAgent, uninstallAgent } from './launchd.js';
import { syncRclone } from './system.js';

const USAGE = `hominem — Hominem CLI

  hominem auth google          Sign in to Google (opens browser) and sync rclone
  hominem auth check [--notify]  Live token check; exit 0 healthy, 1 dead, 2 couldn't check
  hominem auth sync-rclone     Copy the current token into the rclone remote
  hominem agent install        Install the daily 9:00 auth check (launchd)
  hominem agent uninstall      Remove the daily auth check
`;

async function main(argv: string[]): Promise<number> {
  const [group, command, ...flags] = argv;
  const key = `${group ?? ''} ${command ?? ''}`.trim();

  switch (key) {
    case 'auth google':
      await googleAuth();
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
  // Print fixed text keyed by error code, never the raw message, so nothing user-supplied reaches the log.
  console.error(
    error instanceof GoogleAuthError ? FAILURES[error.code] : 'hominem: unexpected error',
  );
  process.exitCode = 1;
}
