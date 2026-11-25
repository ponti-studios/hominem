import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

import { z } from 'zod';

const manifestFileSchema = z.union([
  z.string().min(1),
  z.object({
    file: z.string().min(1),
    word_count: z.number().int().nonnegative().optional(),
    words: z.number().int().nonnegative().optional(),
  }),
]);

const manifestSchema = z.union([
  z.array(manifestFileSchema),
  z.object({
    batch: z.number().int().nonnegative().optional(),
    files: z.array(manifestFileSchema),
  }),
]);

const claimSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['concept', 'opinion', 'prediction', 'definition', 'framework', 'question']),
  statement: z.string().min(1),
  elaboration: z
    .string()
    .refine((value) => value.trim().split(/\s+/).length <= 40, 'elaboration exceeds 40 words')
    .optional(),
  source: z.object({
    file: z.string().min(1),
    section: z.string().nullable(),
  }),
  stance: z.enum(['yours', 'assistant-kept', 'reference']),
  themes: z.array(z.string().min(1)).min(2).max(5),
  artifact: z.unknown().nullable(),
});

const fileSchema = z.object({
  file: z.string().min(1),
  claims: z.number().int().nonnegative(),
  developed: z.number().int().min(0).max(3),
  voice: z.enum(['his', 'generic', 'mixed']),
  self_contained: z.boolean(),
  structural: z.boolean(),
  best_sentence: z.string().min(1),
  note: z.string().min(1),
});

export interface ValidationResult {
  ok: true;
  files: number;
  claims: number;
  bodyCharacters: number;
  summary: {
    yours: number;
    assistantKept: number;
    reference: number;
  };
}

export class KnowledgeValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(
      `extraction batch has ${issues.length} validation error${issues.length === 1 ? '' : 's'}`,
    );
  }
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(
      `${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function readJsonl<T>(path: string, schema: z.ZodType<T>, label: string, issues: string[]): T[] {
  const rows: T[] = [];
  let lines: string[];
  try {
    lines = readFileSync(path, 'utf8').split('\n');
  } catch (error) {
    throw new Error(
      `${path} could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      issues.push(`${label} line ${index + 1}: invalid JSON`);
      continue;
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      issues.push(
        `${label} line ${index + 1}: ${parsed.error.issues[0]?.message ?? 'invalid shape'}`,
      );
      continue;
    }
    rows.push(parsed.data);
  }
  return rows;
}

function manifestFiles(raw: unknown): { files: string[]; batch: number | null } {
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`batch.json: ${parsed.error.issues[0]?.message ?? 'invalid manifest'}`);
  }
  const batch = Array.isArray(parsed.data) ? null : (parsed.data.batch ?? null);
  const entries = Array.isArray(parsed.data) ? parsed.data : parsed.data.files;
  return {
    batch,
    files: entries.map((entry) => (typeof entry === 'string' ? entry : entry.file)),
  };
}

function safeBodyPath(bodiesDir: string, file: string): string {
  if (isAbsolute(file)) throw new Error(`manifest file must be relative: ${file}`);
  const root = realpathSync(bodiesDir);
  const path = realpathSync(resolve(root, file));
  const outside = relative(root, path).startsWith('..');
  if (outside) throw new Error(`manifest file escapes bodies directory: ${file}`);
  return path;
}

export function validateExtraction(
  directory: string,
  bodiesDirectory = join(directory, 'bodies'),
): ValidationResult {
  const root = resolve(directory);
  const manifest = manifestFiles(readJson(join(root, 'batch.json')));
  const issues: string[] = [];
  if (new Set(manifest.files).size !== manifest.files.length) {
    issues.push('batch.json: duplicate file entries');
  }
  const claims = readJsonl(join(root, 'claims.jsonl'), claimSchema, 'claims.jsonl', issues);
  const records = readJsonl(join(root, 'files.jsonl'), fileSchema, 'files.jsonl', issues);

  const claimIds = claims.map((claim) => claim.id);
  if (new Set(claimIds).size !== claimIds.length) issues.push('claims.jsonl: duplicate claim id');
  const idParts = claimIds.map((id) => /^f(\d+)-(\d+)$/.exec(id));
  if (idParts.some((part) => part === null)) {
    issues.push('claims.jsonl: every claim id must match fNN-NNN');
  } else if (idParts.length > 0) {
    const batch = idParts[0]?.[1];
    const numbers = idParts
      .filter((part) => part?.[1] === batch)
      .map((part) => Number(part?.[2]))
      .sort((a, b) => a - b);
    if (numbers.length !== idParts.length)
      issues.push('claims.jsonl: claim ids mix batch prefixes');
    for (const [index, number] of numbers.entries()) {
      if (number !== index + 1) {
        issues.push(`claims.jsonl: claim ids are not sequential from ${batch}-001`);
        break;
      }
    }
    if (manifest.batch !== null && Number(batch) !== manifest.batch) {
      issues.push(
        `claims.jsonl: batch prefix f${batch} does not match batch.json (${manifest.batch})`,
      );
    }
  }

  const manifestSet = new Set(manifest.files);
  const recordsByFile = new Map(records.map((record) => [record.file, record]));
  if (new Set(records.map((record) => record.file)).size !== records.length) {
    issues.push('files.jsonl: duplicate file records');
  }
  for (const record of records) {
    if (!manifestSet.has(record.file)) issues.push(`files.jsonl: unexpected file ${record.file}`);
  }
  for (const file of manifest.files) {
    if (!recordsByFile.has(file)) issues.push(`files.jsonl: missing file ${file}`);
  }
  for (const claim of claims) {
    if (!manifestSet.has(claim.source.file)) {
      issues.push(`claims.jsonl: claim ${claim.id} names unexpected file ${claim.source.file}`);
    }
  }

  for (const file of manifest.files) {
    const record = recordsByFile.get(file);
    const fileClaims = claims.filter((claim) => claim.source.file === file);
    if (record && record.claims !== fileClaims.length) {
      issues.push(`${file}: files.jsonl claims=${record.claims}, found=${fileClaims.length}`);
    }
    if (!record) continue;
    try {
      const body = readFileSync(safeBodyPath(resolve(bodiesDirectory), file), 'utf8');
      if (!body.includes(record.best_sentence)) {
        issues.push(`${file}: best_sentence is not verbatim in the body`);
      }
    } catch (error) {
      issues.push(
        `${file}: body could not be verified: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (issues.length > 0) throw new KnowledgeValidationError(issues);
  const bodyCharacters = manifest.files.reduce((total, file) => {
    return total + readFileSync(safeBodyPath(resolve(bodiesDirectory), file), 'utf8').length;
  }, 0);
  return {
    ok: true,
    files: manifest.files.length,
    claims: claims.length,
    bodyCharacters,
    summary: {
      yours: claims.filter((claim) => claim.stance === 'yours').length,
      assistantKept: claims.filter((claim) => claim.stance === 'assistant-kept').length,
      reference: claims.filter((claim) => claim.stance === 'reference').length,
    },
  };
}
