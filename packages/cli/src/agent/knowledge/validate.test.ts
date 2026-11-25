import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { KnowledgeValidationError, validateExtraction } from './validate.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-knowledge-'));
  mkdirSync(join(dir, 'bodies'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeBatch(options: { count?: number; sentence?: string; claimId?: string } = {}): void {
  writeFileSync(
    join(dir, 'batch.json'),
    JSON.stringify({ batch: 1, files: [{ file: 'note.md', word_count: 8 }] }),
  );
  writeFileSync(
    join(dir, 'bodies/note.md'),
    'A faithful sentence stays in the note.\nAnother sentence follows.',
  );
  writeFileSync(
    join(dir, 'claims.jsonl'),
    `${JSON.stringify({
      id: options.claimId ?? 'f1-001',
      type: 'concept',
      statement: 'A faithful sentence stays in the note.',
      source: { file: 'note.md', section: 'Idea' },
      stance: 'yours',
      themes: ['note', 'faithful'],
      artifact: null,
    })}\n`,
  );
  writeFileSync(
    join(dir, 'files.jsonl'),
    `${JSON.stringify({
      file: 'note.md',
      claims: options.count ?? 1,
      developed: 2,
      voice: 'his',
      self_contained: true,
      structural: false,
      best_sentence: options.sentence ?? 'A faithful sentence stays in the note.',
      note: 'A complete source note.',
    })}\n`,
  );
}

describe('extraction validator', () => {
  it('accepts a complete, internally reconciled batch', () => {
    writeBatch();
    const result = validateExtraction(dir);
    expect(result).toEqual({
      ok: true,
      files: 1,
      claims: 1,
      bodyCharacters: readFileSync(join(dir, 'bodies/note.md'), 'utf8').length,
      summary: { yours: 1, assistantKept: 0, reference: 0 },
    });
  });

  it('rejects non-verbatim best sentences and per-file count drift', () => {
    writeBatch({ count: 2, sentence: 'A sentence that is not in the source.' });
    expect(() => validateExtraction(dir)).toThrow(KnowledgeValidationError);
    try {
      validateExtraction(dir);
    } catch (error) {
      expect(error).toBeInstanceOf(KnowledgeValidationError);
      expect((error as KnowledgeValidationError).issues).toEqual([
        'note.md: files.jsonl claims=2, found=1',
        'note.md: best_sentence is not verbatim in the body',
      ]);
    }
  });

  it('rejects duplicate claim ids and malformed claim JSONL', () => {
    writeBatch();
    const claim = readFileSync(join(dir, 'claims.jsonl'), 'utf8');
    writeFileSync(join(dir, 'claims.jsonl'), `${claim}${claim}{broken\n`);
    expect(() => validateExtraction(dir)).toThrow(KnowledgeValidationError);
    try {
      validateExtraction(dir);
    } catch (error) {
      expect((error as KnowledgeValidationError).issues).toContain(
        'claims.jsonl: duplicate claim id',
      );
      expect((error as KnowledgeValidationError).issues).toContain(
        'claims.jsonl line 3: invalid JSON',
      );
    }
  });

  it('rejects mixed or non-sequential claim ids', () => {
    writeBatch({ claimId: 'f2-009' });
    try {
      validateExtraction(dir);
    } catch (error) {
      expect((error as KnowledgeValidationError).issues).toContain(
        'claims.jsonl: claim ids are not sequential from 2-001',
      );
      expect((error as KnowledgeValidationError).issues).toContain(
        'claims.jsonl: batch prefix f2 does not match batch.json (1)',
      );
    }
  });
});
