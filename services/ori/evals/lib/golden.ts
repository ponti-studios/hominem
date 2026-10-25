import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const oriRoot = new URL('../../', import.meta.url).pathname;

export type Golden = {
  name?: string;
  category?: string;
  input: string;
  expectedOutput: string;
  additionalMetadata?: Record<string, unknown>;
};

/** Open-ended replies: no single right answer, so say what a good reply must do instead. */
export type CriteriaGolden = Omit<Golden, 'expectedOutput'> & { criteria: string[] };

export type PromptMessage = { role: string; content: string };

export const targetModel = process.env.ORI_TARGET_MODEL?.trim() || 'openai/gpt-5-mini';
/** Models that production runs, so a suite measures what ships. `ORI_TARGET_MODEL` overrides all of them. */
const shipped = (model: string): string => process.env.ORI_TARGET_MODEL?.trim() || model;
export const chatModel = shipped('openai/gpt-6-luna');
export const timeBlockModel = shipped('z-ai/glm-5.3-flash');
export const judgeModel = process.env.ORI_JUDGE_MODEL?.trim() || 'openai/gpt-6-luna';
export const currentUtcDate = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date());

/** The date line prod puts in the chat prompt, weekday included, e.g. "2026-10-25 (Sunday)". */
export const currentUtcDateLabel = (): string =>
  `${currentUtcDate()} (${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(new Date())})`;

export const loadText = (url: URL): Promise<string> => readFile(url, 'utf8');

export const loadJson = async <T>(url: URL): Promise<T> => JSON.parse(await loadText(url)) as T;

/** Short content hash so two runs can prove they graded the same dataset or prompt. */
export const fingerprint = async (urls: readonly URL[]): Promise<string> => {
  const hash = createHash('sha256');
  for (const url of urls) hash.update(await readFile(url));
  return hash.digest('hex').slice(0, 12);
};

/** Hash of arbitrary grading inputs (rubrics, schemas, expectations) plus the grader source files. */
export const fingerprintGrading = async (files: readonly URL[], spec: unknown): Promise<string> => {
  const hash = createHash('sha256');
  for (const url of files) hash.update(await readFile(url));
  // Assertion specs embed absolute file:// paths; strip the checkout location so the hash
  // is the same on every machine.
  hash.update(JSON.stringify(spec).replaceAll(oriRoot, ''));
  return hash.digest('hex').slice(0, 12);
};

export const render = (template: string, values: Record<string, string>): string =>
  template.replace(/{{\s*([^}]+?)\s*}}/g, (_, key: string) => values[key.trim()] ?? '');

export const renderMessages = (
  messages: PromptMessage[],
  values: Record<string, string>,
): PromptMessage[] =>
  messages.map((message) => ({ ...message, content: render(message.content, values) }));
