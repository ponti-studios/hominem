#!/usr/bin/env node
// Print the benchmark trend from scripts/analysis/history/benchmarks.jsonl.
// Run with `just analysis history`. Pass a number to show the last N runs.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readHistory } from './lib/history.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const limit = Number(process.argv[2] ?? 15);

const runs = readHistory(root).slice(-limit);
if (runs.length === 0) {
  console.log('No benchmark history yet. Run `just analysis load` or `just analysis weekly`.');
  process.exit(0);
}

const p95 = (run, scenario, at) =>
  run.load?.stages.find((s) => s.scenario === scenario && s.concurrency === at)?.p95Ms ?? '-';
const rps = (run, scenario, at) =>
  run.load?.stages.find((s) => s.scenario === scenario && s.concurrency === at)?.rps ?? '-';

const rows = runs.map((r) => {
  const dirty = r.dirty ? r.dirty.modified + r.dirty.deleted + r.dirty.untracked : '-';
  const at = r.load?.budgetAt ?? 10;
  return {
    when: r.at.slice(0, 16).replace('T', ' '),
    head: r.head ?? '-',
    dirty,
    'healthz p95 (api)': r.api?.healthz?.p95Ms ?? '-',
    [`healthz p95 @${at}`]: p95(r, 'healthz', at),
    [`healthz rps @${at}`]: rps(r, 'healthz', at),
    [`unauth p95 @${at}`]: p95(r, 'finance.transactions.list.unauth', at),
    'probes failing': r.load ? r.load.probesFailing.length : '-',
  };
});

console.table(rows);
