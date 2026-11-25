import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it, vi } from 'vitest';

import { applyEnvDefaults, loadEnvFile } from './wealth-env.js';

it('loads the machine environment without overriding exported variables or executing shell syntax', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'hominem-wealth-env-test-'));
  const path = join(dir, 'env');
  vi.stubEnv('WEALTH_FIXTURE_EXISTING', 'exported');
  vi.stubEnv('WEALTH_FIXTURE_FILE', undefined);
  vi.stubEnv('WEALTH_FIXTURE_REFERENCE', undefined);
  vi.stubEnv('WEALTH_FIXTURE_LITERAL', undefined);
  try {
    await writeFile(
      path,
      [
        'export WEALTH_FIXTURE_EXISTING=from-file',
        'WEALTH_FIXTURE_FILE="fixture value"',
        'WEALTH_FIXTURE_REFERENCE=$WEALTH_FIXTURE_EXISTING',
        'WEALTH_FIXTURE_LITERAL=$(not-a-command)',
      ].join('\n'),
    );
    const values = await loadEnvFile(path);
    expect(values.WEALTH_FIXTURE_LITERAL).toBe('$(not-a-command)');
    await applyEnvDefaults(path);
    expect(process.env.WEALTH_FIXTURE_EXISTING).toBe('exported');
    expect(process.env.WEALTH_FIXTURE_FILE).toBe('fixture value');
    expect(process.env.WEALTH_FIXTURE_REFERENCE).toBe('exported');
    expect(process.env.WEALTH_FIXTURE_LITERAL).toBe('$(not-a-command)');
  } finally {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  }
});
