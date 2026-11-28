import { readFile, writeFile } from 'node:fs/promises';

import { describe, expect, vi } from 'vitest';

import { signInWithSetup } from './hominem-setup.js';
import { authSetupTest as it, fakeHominemApi } from './test/auth-fixtures';

describe('hominem auth setup', () => {
  it('asks again until the URL works, then saves it without touching other lines', async ({
    envFile,
  }) => {
    await writeFile(envFile, 'KEEP=me\nexport HOMINEM_API_URL=http://localhost:1\n');
    const ask = vi
      .fn<(question: string) => Promise<string>>()
      .mockResolvedValueOnce('not a url')
      .mockResolvedValueOnce('https://api.test/');

    // The fake refuses registration, which proves sign-in carried on with the new URL.
    await expect(
      signInWithSetup({ envFile, ask, fetchImpl: fakeHominemApi('https://api.test') }),
    ).rejects.toThrow('Hominem client registration failed (HTTP 503).');

    expect(ask).toHaveBeenCalledTimes(2);
    expect(await readFile(envFile, 'utf8')).toBe('KEEP=me\nHOMINEM_API_URL=https://api.test\n');
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('unset'));
  });

  it('uses the production API on Enter and warns when an exported value would win', async ({
    envFile,
  }) => {
    vi.stubEnv('HOMINEM_API_URL', 'http://localhost:1');

    await expect(
      signInWithSetup({
        envFile,
        ask: async () => '',
        fetchImpl: fakeHominemApi('https://api.ponti.io'),
      }),
    ).rejects.toThrow('registration failed');

    expect(await readFile(envFile, 'utf8')).toBe('HOMINEM_API_URL=https://api.ponti.io\n');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('unset HOMINEM_API_URL'));
  });

  it('asks nothing and saves nothing when the URL already works', async ({ envFile }) => {
    const ask = vi.fn<(question: string) => Promise<string>>();

    await expect(
      signInWithSetup({ envFile, ask, fetchImpl: fakeHominemApi('https://api.ponti.io') }),
    ).rejects.toThrow('registration failed');

    expect(ask).not.toHaveBeenCalled();
    await expect(readFile(envFile, 'utf8')).rejects.toThrow('ENOENT');
  });

  it('passes the failure through when nobody can answer', async ({ envFile }) => {
    await expect(
      signInWithSetup({ envFile, fetchImpl: fakeHominemApi('https://api.test') }),
    ).rejects.toMatchObject({ code: 'ECONNREFUSED' });
  });
});
