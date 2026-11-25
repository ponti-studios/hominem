import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { applyEnvDefaults, loadEnvFile } from './env.ts';

describe('agent env', () => {
  it('loads export lines and expands known variables without shell evaluation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hominem-agent-env-'));
    const file = join(dir, 'env');
    writeFileSync(
      file,
      `export GWS_CLI="$HOME/.hominem/bin/gws"
PLAIN=~/work
UNSET=$NOT_DEFINED
`,
    );
    expect(loadEnvFile(file)).toEqual({
      GWS_CLI: `${process.env.HOME}/.hominem/bin/gws`,
      PLAIN: `${process.env.HOME}/work`,
      UNSET: '$NOT_DEFINED',
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it('applies file values without overriding exported variables or executing shell syntax', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hominem-agent-env-'));
    const file = join(dir, 'env');
    vi.stubEnv('WEALTH_FIXTURE_EXISTING', 'exported');
    vi.stubEnv('WEALTH_FIXTURE_FILE', undefined);
    vi.stubEnv('WEALTH_FIXTURE_LITERAL', undefined);
    try {
      writeFileSync(
        file,
        [
          'export WEALTH_FIXTURE_EXISTING=from-file',
          'WEALTH_FIXTURE_FILE="fixture value"',
          'WEALTH_FIXTURE_LITERAL=$(not-a-command)',
        ].join('\n'),
      );
      applyEnvDefaults(file);
      expect(process.env.WEALTH_FIXTURE_EXISTING).toBe('exported');
      expect(process.env.WEALTH_FIXTURE_FILE).toBe('fixture value');
      expect(process.env.WEALTH_FIXTURE_LITERAL).toBe('$(not-a-command)');
    } finally {
      vi.unstubAllEnvs();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
