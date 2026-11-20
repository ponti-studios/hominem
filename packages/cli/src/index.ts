#!/usr/bin/env bun
import { checkAuth, googleAuth } from './auth.js';
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

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  // Strip line breaks so a user-supplied value in the message can't forge extra log lines.
  const message = String(error instanceof Error ? error.message : error);
  console.error(message.replace(/\n|\r/g, ' '));
  process.exitCode = 1;
}
