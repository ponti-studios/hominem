#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { executeTasks } from '../connectors/google-tasks/google_tasks.ts';
import { taskListId } from '../connectors/google-tasks/google_tasks.ts';
import { finishRun, logRun } from '../log/agent_log.ts';
import templatesFile from './cadence_templates.json' with { type: 'json' };

const LISTS = {
  weekly: 'Weekly Cadence',
  monthly: 'Monthly Cadence',
} as const;

type Cadence = keyof typeof LISTS;
type CadenceList = (typeof LISTS)[Cadence];

interface Result {
  ok: true;
  cadence: Cadence;
  list: CadenceList;
  created: number;
  already_open: number;
  run_id: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJson(path: string, label: string): unknown {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`${label} could not be read at ${path}: ${(err as Error).message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`${label} is not valid JSON at ${path}: ${(err as Error).message}`);
  }
}

function taskTitles(value: unknown, path: string, list: CadenceList): string[] {
  if (!isRecord(value) || !Array.isArray(value[list])) {
    throw new Error(`cadence templates at ${path} must contain an array for "${list}"`);
  }
  const titles = value[list];
  if (titles.some((title) => typeof title !== 'string' || title === '')) {
    throw new Error(`cadence templates at ${path} contains an invalid title for "${list}"`);
  }
  const strings = titles as string[];
  if (new Set(strings).size !== strings.length) {
    throw new Error(`cadence templates at ${path} contains duplicate titles for "${list}"`);
  }
  return strings;
}

async function runTasks(args: string[]): Promise<unknown> {
  const real = process.env.GOOGLE_TASKS_CLI;
  if (!real) return executeTasks(args);
  const proc = await new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(real, args, { env: process.env });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));
      child.on('error', reject);
      child.on('close', (status) => resolve({ status, stdout, stderr }));
    },
  );
  if (proc.status !== 0) {
    const detail = (proc.stderr || proc.stdout).trim() || `exit ${proc.status}`;
    throw new Error(`google-tasks failed: ${detail}`);
  }
  let value: unknown;
  try {
    value = JSON.parse(proc.stdout);
  } catch (err) {
    throw new Error(`google-tasks returned invalid JSON: ${(err as Error).message}`);
  }
  return value;
}

function resolveList(response: unknown, list: CadenceList): string {
  if (!isRecord(response) || !Array.isArray(response['items'])) {
    throw new Error('tasklists returned a non-object or non-array items field');
  }
  const items = response['items'].filter(
    (item): item is Record<string, unknown> =>
      item !== null && typeof item === 'object' && !Array.isArray(item),
  );
  const id = taskListId(items, list);
  if (!id) throw new Error(`Google Tasks has no unique list named "${list}"`);
  return id;
}

function openTitles(response: unknown): Set<string> {
  if (!isRecord(response)) throw new Error('tasks list returned a non-object response');
  const items = response['items'] ?? [];
  if (!Array.isArray(items)) throw new Error('tasks list response has a non-array items field');
  const titles = new Set<string>();
  for (const item of items) {
    if (!isRecord(item) || typeof item['title'] !== 'string') {
      throw new Error('tasks list response contains a task without a title');
    }
    titles.add(item['title']);
  }
  return titles;
}

function cadenceArg(args: string[]): Cadence | null {
  if (args.length !== 1) return null;
  const arg = args[0];
  if (arg === 'weekly' || arg === 'monthly') return arg;
  return null;
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  const cadence = cadenceArg(args);
  if (!cadence) {
    process.stderr.write('cadence-regenerate: expected exactly one argument: weekly or monthly\n');
    return 2;
  }

  const list = LISTS[cadence];
  const dbPath = process.env.HOMINEM_AGENT_DB;
  const runId = logRun('cadence-regen', {
    status: 'invoked',
    context: { cadence, list },
    path: dbPath,
  });

  try {
    const templatesPath = process.env.CADENCE_TEMPLATES_FILE;
    const templateSource = templatesPath
      ? readJson(templatesPath, 'cadence templates')
      : templatesFile;
    const templates = taskTitles(
      templateSource,
      templatesPath ?? 'embedded cadence templates',
      list,
    );
    const id = resolveList(await runTasks(['tasklists']), list);

    const existing = openTitles(await runTasks(['list', '--tasklist', id]));
    let created = 0;
    for (const title of templates) {
      if (existing.has(title)) continue;
      await runTasks(['insert', '--tasklist', id, '--json', JSON.stringify({ title })]);
      existing.add(title);
      created += 1;
    }

    const result: Result = {
      ok: true,
      cadence,
      list,
      created,
      already_open: templates.length - created,
      run_id: runId,
    };
    finishRun(runId, {
      status: 'ok',
      exitCode: 0,
      message: `${list}: created ${created}, already open ${result.already_open}`,
      path: dbPath,
    });
    process.stdout.write(`${list}: created ${created}, already open ${result.already_open}\n`);
    return 0;
  } catch (err) {
    const message = `${(err as Error).name ?? 'Error'}: ${(err as Error).message ?? String(err)}`;
    finishRun(runId, {
      status: 'failed',
      exitCode: 1,
      message: message.slice(0, 500),
      path: dbPath,
    });
    process.stderr.write(`cadence-regenerate: ${message}\n`);
    return 1;
  }
}
