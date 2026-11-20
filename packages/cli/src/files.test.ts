import { mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { writeFileAtomic } from './files.js';

describe('writeFileAtomic', () => {
  it('replaces the file, locks it to 0600 even if it existed with looser perms, and leaves no temp file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hominem-cli-'));
    const path = join(dir, 'token.json');
    await writeFile(path, 'old', { mode: 0o644 });

    await writeFileAtomic(path, 'new');

    expect(await readFile(path, 'utf8')).toBe('new');
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(await readdir(dir)).toEqual(['token.json']);
  });
});
