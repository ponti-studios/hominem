import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

const home = mkdtempSync(join(tmpdir(), 'hominem-cli-'));
afterAll(() => rmSync(home, { recursive: true, force: true }));

// Runs the real entry point with bun, against an empty home so nothing is signed in.
function hominem(...args: string[]) {
  return spawnSync('bun', ['run', 'src/index.ts', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, HOMINEM_HOME: home, HOMINEM_AGENT_ENV_FILE: join(home, 'env') },
  });
}

describe('hominem commands', () => {
  it('registers every command file', () => {
    const files = readdirSync(join(import.meta.dirname, 'commands'), { recursive: true })
      .map(String)
      .filter((file) => file.endsWith('.ts') && file !== 'index.ts')
      .map((file) => file.replace(/(\/index)?\.ts$/, '').replaceAll('/', ':'));
    // Only bun can load the registry: commands import `.md` and `.py` files as text.
    const registry = spawnSync(
      'bun',
      [
        '-e',
        "import { COMMANDS } from './src/commands/index.ts'; console.log(JSON.stringify(Object.keys(COMMANDS)))",
      ],
      { encoding: 'utf8' },
    );
    expect(JSON.parse(registry.stdout).sort()).toEqual(files.sort());
  });

  it.each([[[]], [['help']], [['--help']]])('lists commands and topics for %j', (args) => {
    const result = hominem(...args);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('finance');
    expect(result.stdout).toContain('Run the personal agent');
  });

  it('shows the flags of a nested command', () => {
    const result = hominem('finance', 'sync', '--help');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--bank');
    expect(result.stdout).toContain('--dry-run');
  });

  it('refuses a bank it cannot sync', () => {
    const result = hominem('finance', 'sync', '--bank', 'monzo');
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      error: expect.stringContaining('--bank=monzo'),
    });
  });

  it.each([[['nope']], [['wealth', 'nope']], [['auth', 'check', '--nope']]])(
    'exits 2 for %j',
    (args) => {
      expect(hominem(...args).status).toBe(2);
    },
  );

  it.each(['chat', 'remember', 'recall', 'reflect'])(
    'shows help for %s instead of starting the agent',
    (command) => {
      const result = hominem(command, '--help');
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`$ hominem ${command}`);
    },
  );

  it('leaves help for a passthrough command to the command itself', () => {
    const result = hominem('tasks', '--help');
    expect(result.stdout).not.toContain('USAGE\n  $ hominem tasks');
  });
});
