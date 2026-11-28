import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, vi } from 'vitest';

import { DEFAULT_API_URL, type HominemToken } from './hominem-auth';
import { fakeAccessToken, wealthTest as it } from './test/wealth-fixtures';
import { accountKey } from './wealth-state';

function token(overrides: Partial<HominemToken> = {}): HominemToken {
  return {
    api_url: DEFAULT_API_URL,
    token_endpoint: `${DEFAULT_API_URL}/token`,
    client_id: 'client-one',
    access_token: fakeAccessToken(),
    refresh_token: 'fixture-refresh',
    expires_at: 0,
    ...overrides,
  };
}

const CHECKPOINT = '{"starling_max":"2026-01-03"}';

describe('wealth account files', () => {
  it('keeps one key across sign-ins and separates users and APIs', async ({ home }) => {
    const first = await accountKey(home, token());
    expect(await accountKey(home, token({ client_id: 'client-two' }))).toBe(first);
    expect(await accountKey(home, token({ access_token: fakeAccessToken('other') }))).not.toBe(
      first,
    );
    expect(await accountKey(home, token({ api_url: 'https://api.test' }))).not.toBe(first);
  });

  it('claims unscoped files for the production account, once', async ({ home }) => {
    const notice = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    await writeFile(join(home, 'hominem_sync_state.json'), CHECKPOINT);
    const key = await accountKey(home, token());
    expect(await readFile(join(home, `sync-${key}.json`), 'utf8')).toBe(CHECKPOINT);
    expect(await readdir(home)).not.toContain('hominem_sync_state.json');
    expect(notice).toHaveBeenCalledWith(expect.stringContaining('hominem_sync_state.json'));
  });

  it('leaves unscoped files alone for any other API', async ({ home }) => {
    await writeFile(join(home, 'hominem_sync_state.json'), CHECKPOINT);
    await accountKey(home, token({ api_url: 'https://api.test' }));
    expect(await readdir(home)).toContain('hominem_sync_state.json');
  });

  it('moves client-scoped files over without replacing newer ones', async ({ home }) => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const old = createHash('sha256').update(`${DEFAULT_API_URL}\0client-one`).digest('hex');
    await writeFile(join(home, `sync-${old}.json`), CHECKPOINT);
    await writeFile(join(home, 'hominem_sync_state.json'), '{}');
    const key = await accountKey(home, token());
    await accountKey(home, token());
    expect(await readFile(join(home, `sync-${key}.json`), 'utf8')).toBe(CHECKPOINT);
    expect(await readdir(home)).toContain('hominem_sync_state.json');
  });

  it('asks for a new sign-in when the token cannot be read', async ({ home }) => {
    await expect(accountKey(home, token({ access_token: 'opaque' }))).rejects.toThrow(
      'run `hominem auth` again',
    );
  });
});
