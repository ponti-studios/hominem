// Where the wealth routines keep their per-account files on this machine.
import { createHash } from 'node:crypto';
import { access, rename } from 'node:fs/promises';
import { join } from 'node:path';

import { DEFAULT_API_URL, hominemSubject, type HominemToken } from './hominem-auth.js';

const FILES = [
  { name: 'sync', unkeyed: 'hominem_sync_state.json' },
  { name: 'pending_unmapped', unkeyed: 'pending_unmapped.json' },
  { name: 'morning_brief_bills', unkeyed: 'morning_brief_bills.json' },
] as const;

function hash(apiUrl: string, id: string): string {
  return createHash('sha256').update(`${apiUrl}\0${id}`).digest('hex');
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

/**
 * The key for this account's files: the API plus who's signed in, so it survives signing in again
 * (which mints a new OAuth client ID every time). Files saved under older names get renamed to it
 * the first time, never over a newer one. The oldest names don't say whose they are, so only the
 * production API claims them.
 */
export async function accountKey(dir: string, token: HominemToken): Promise<string> {
  const key = hash(token.api_url, hominemSubject(token.access_token));
  const clientKey = hash(token.api_url, token.client_id);
  for (const { name, unkeyed } of FILES) {
    const target = join(dir, `${name}-${key}.json`);
    if (await exists(target)) continue;
    const older = [`${name}-${clientKey}.json`];
    if (token.api_url === DEFAULT_API_URL) older.push(unkeyed);
    for (const file of older) {
      const source = join(dir, file);
      if (!(await exists(source))) continue;
      await rename(source, target);
      // stderr, so stdout stays clean JSON.
      process.stderr.write(`hominem wealth: picked up ${file} for your account.\n`);
      break;
    }
  }
  return key;
}
