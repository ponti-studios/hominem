import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from './nameplate.ts';

let dir: string;
let dbPath: string;
let font: string;
let texture: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-nameplate-'));
  dbPath = join(dir, 'agent.db');
  texture = join(dir, 'texture.png');
  process.env.HOMINEM_AGENT_DB = dbPath;
  process.env.HOMINEM_PYTHON = 'python3';
  font = findFont();
  createTexture(texture);
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.HOMINEM_AGENT_DB;
  delete process.env.HOMINEM_PYTHON;
  rmSync(dir, { recursive: true, force: true });
});

function findFont(): string {
  const candidates = [
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Geneva.ttf',
    '/Library/Fonts/Arial.ttf',
  ];
  const fontPath = candidates.find((candidate) => existsSync(candidate));
  if (!fontPath) throw new Error('no system font available for nameplate test');
  return fontPath;
}

function createTexture(path: string): void {
  const result = spawnSync(
    'python3',
    [
      '-c',
      'from PIL import Image, ImageDraw\n' +
        'im=Image.new("RGB",(48,48),(185,190,200)); d=ImageDraw.Draw(im); ' +
        '[(d.polygon([(x,y),(x+12,y+6),(x+8,y+22),(x-4,y+16)],fill=(245,248,255))) ' +
        'for x,y in ((4,4),(28,12),(10,28))]; im.save(__import__("sys").argv[1])',
      path,
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(result.stderr);
}

function args(preset: 'platinum' | 'gold', output: string, preview?: string): string[] {
  const result = [
    'nameplate',
    '--word',
    'TEST',
    '--font',
    font,
    '--texture',
    texture,
    '--preset',
    preset,
    '--output',
    output,
    '--width',
    '320',
    '--padding',
    '30',
    '--tile',
    '48',
    '--sparkles',
    '4',
    '--seed',
    '9',
  ];
  if (preview) result.push('--preview', preview);
  return result;
}

function hash(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('studio nameplate', () => {
  it('renders deterministic, distinct platinum and gold assets with previews', async () => {
    const platinum = join(dir, 'platinum.png');
    const platinumAgain = join(dir, 'platinum-again.png');
    const gold = join(dir, 'gold.png');
    const preview = join(dir, 'preview.jpg');

    expect(await main(args('platinum', platinum, preview))).toBe(0);
    expect(await main(args('platinum', platinumAgain))).toBe(0);
    expect(await main(args('gold', gold))).toBe(0);

    expect(hash(platinum)).toBe(hash(platinumAgain));
    expect(hash(platinum)).not.toBe(hash(gold));
    expect(existsSync(preview)).toBe(true);
  }, 30_000);

  it('rejects missing inputs before opening an audit run', async () => {
    const result = await main(
      args('gold', join(dir, 'out.png')).flatMap((arg, index, all) =>
        arg === '--font'
          ? [arg, join(dir, 'missing.ttf')]
          : index > 0 && all[index - 1] === '--font'
            ? []
            : [arg],
      ),
    );
    expect(result).toBe(2);
    expect(existsSync(dbPath)).toBe(false);
  });

  it('names renderer startup failures and closes the run', async () => {
    process.env.HOMINEM_PYTHON = join(dir, 'missing-python');
    expect(await main(args('gold', join(dir, 'out.png')))).toBe(1);
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const run = db
      .prepare('SELECT status, exit_code, message FROM runs ORDER BY id DESC LIMIT 1')
      .get();
    db.close();
    expect(run).toMatchObject({ status: 'failed', exit_code: 1 });
    expect(String(run?.['message'])).toContain('could not start');
  });
});
