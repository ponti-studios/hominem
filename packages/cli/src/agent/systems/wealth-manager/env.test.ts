import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadEnvFile } from './env.ts';

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
});
