import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';

import type { RunManifest } from './types';

const packageRoot = new URL('../', import.meta.url).pathname;
const runsDir = `${packageRoot}runs`;
const ledgerFile = `${packageRoot}ledger.csv`;

export const ledgerColumns = [
  'runId',
  'gitSha',
  'promptHash',
  'suite',
  'tier',
  'cases',
  'trials',
  'limited',
  'passRate',
  'passAllRate',
  'errors',
  'costUsd',
  'promptTokens',
  'completionTokens',
  'p50Ms',
  'p95Ms',
  'targetModel',
  'judgeModel',
] as const;

type Row = Record<(typeof ledgerColumns)[number], string | number | boolean>;

export function ledgerRows(manifest: RunManifest): Row[] {
  return manifest.suites.map((record) => ({
    runId: manifest.runId,
    gitSha: manifest.gitSha,
    promptHash: record.promptHash,
    suite: record.suite,
    tier: record.tier,
    cases: record.summary.cases,
    trials: record.trialsPerCase,
    limited: record.limited,
    passRate: record.summary.passRate,
    passAllRate: record.summary.passAllRate,
    errors: record.summary.errors,
    costUsd: record.summary.costUsd,
    promptTokens: record.summary.promptTokens,
    completionTokens: record.summary.completionTokens,
    p50Ms: record.summary.latencyP50Ms,
    p95Ms: record.summary.latencyP95Ms,
    targetModel: record.targetModel,
    judgeModel: record.judgeModel,
  }));
}

function cell(value: string | number | boolean): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function renderLedger(rows: Row[]): string {
  const sorted = [...rows].sort((a, b) =>
    `${a.runId}${a.suite}`.localeCompare(`${b.runId}${b.suite}`),
  );
  const lines = sorted.map((row) => ledgerColumns.map((key) => cell(row[key])).join(','));
  return `${[ledgerColumns.join(','), ...lines].join('\n')}\n`;
}

/** Rebuilds ledger.csv from every runs/<id>/results.json. Safe to repeat: same input, same file. */
export async function writeLedger(): Promise<{ rows: Row[]; total: number }> {
  const rows: Row[] = [];
  if (existsSync(runsDir)) {
    for (const entry of await readdir(runsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const file = `${runsDir}/${entry.name}/results.json`;
      if (!existsSync(file)) continue;
      try {
        rows.push(...ledgerRows(JSON.parse(await readFile(file, 'utf8')) as RunManifest));
      } catch {
        // A half-written or old-format results file shouldn't sink the whole ledger.
      }
    }
  }
  await writeFile(ledgerFile, renderLedger(rows));
  return { rows, total: rows.reduce((sum, row) => sum + Number(row.costUsd), 0) };
}

export async function printLedger(): Promise<void> {
  const { rows, total } = await writeLedger();
  const recent = [...rows].sort((a, b) => `${b.runId}`.localeCompare(`${a.runId}`)).slice(0, 15);
  const pct = (n: string | number | boolean) => `${Math.round(Number(n) * 100)}%`;
  console.log('| run | sha | suite | cases×trials | pass | pass^k | cost |');
  console.log('|---|---|---|---|---|---|---|');
  for (const r of recent) {
    console.log(
      `| ${r.runId}${r.limited ? ' (limited)' : ''} | ${r.gitSha} | ${r.suite} | ${r.cases}×${r.trials} | ${pct(r.passRate)} | ${pct(r.passAllRate)} | $${Number(r.costUsd).toFixed(4)} |`,
    );
  }
  console.log(
    `\n${rows.length} suite runs, total cost $${total.toFixed(2)}. Full history: ledger.csv`,
  );
}
