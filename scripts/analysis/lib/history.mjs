// Benchmark history. One JSON line per measured run, committed to the repo so
// the trend survives a laptop wipe. Full reports stay gitignored; this file is
// the durable part.
//
// Each line is a compact summary: when, which commit, how dirty the tree was,
// and the numbers that matter. A malformed line is skipped, not fatal, so one
// bad append can't hide the rest of the history.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const HISTORY_PATH = 'scripts/analysis/history/benchmarks.jsonl';

export function summarizeRun(report) {
  const cb = report.codebase;
  const entry = {
    at: report.generatedAt,
    head: cb?.git?.head ?? null,
    branch: cb?.git?.branch ?? null,
    dirty: cb?.git?.dirty ?? null,
    api: null,
    load: null,
    build: null,
  };

  const endpoints = report.apiLatency?.endpoints;
  if (report.apiLatency?.status === 'ok' && endpoints) {
    entry.api = {};
    for (const [name, e] of Object.entries(endpoints)) {
      if (e.p95Ms != null) entry.api[name] = { p50Ms: e.p50Ms, p95Ms: e.p95Ms, p99Ms: e.p99Ms };
    }
  }

  if (report.load?.status === 'ok') {
    entry.load = {
      budgetAt: report.load.budgetAt,
      failures: report.load.failures,
      stages: report.load.stages.map((s) => ({
        scenario: s.scenario,
        concurrency: s.concurrency,
        rps: s.rps,
        p50Ms: s.p50Ms,
        p95Ms: s.p95Ms,
        p99Ms: s.p99Ms,
        errorRate: s.errorRate,
      })),
      probesFailing: report.load.probes.filter((p) => !p.pass).map((p) => p.name),
    };
  }

  if (report.build && report.build.status !== 'skipped') {
    entry.build = {};
    for (const [name, t] of Object.entries(report.build)) {
      if (name === 'webClientBytes') entry.build.webClientBytes = t;
      else entry.build[name] = { status: t.status, seconds: t.seconds ?? null };
    }
  }

  return entry;
}

// Only record runs that measured something. A codebase-only run adds no
// benchmark signal and would just clutter the trend.
export function hasMeasurements(entry) {
  return entry.api !== null || entry.load !== null || entry.build !== null;
}

export function appendHistory(root, entry, path = HISTORY_PATH) {
  const abs = join(root, path);
  mkdirSync(dirname(abs), { recursive: true });
  appendFileSync(abs, `${JSON.stringify(entry)}\n`);
  return abs;
}

export function readHistory(root, path = HISTORY_PATH) {
  const abs = join(root, path);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const line of readFileSync(abs, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // skip a bad line; keep the rest
    }
  }
  return out;
}

// Trend for one metric across runs, e.g. ('healthz', 'p95Ms').
export function trend(entries, pick) {
  return entries
    .map((e) => ({ at: e.at, head: e.head, value: pick(e) }))
    .filter((p) => p.value != null);
}
