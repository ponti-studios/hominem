#!/usr/bin/env node
// Weekly platform analysis. Run it with `just analysis weekly`.
//
// Sections:
//   finance-plan   Re-checks each claim the finance redesign plan makes about
//                  current code, and tracks target gaps (open -> done).
//   codebase       LOC, endpoint and MCP tool counts, test counts, debt markers,
//                  and git state (branch, HEAD, dirty files).
//   api-latency    Sequential latency of key API endpoints against a running API.
//   build          Typecheck and web build timings. Only with --full.
//   load           Concurrent load budgets and hostile-input probes. Only with --load.
//
// Each run writes reports/<timestamp>.json and reports/<timestamp>.md, then diffs
// against the previous JSON report. Reports are gitignored; keep them locally
// or archive them yourself.
//
// Flags:
//   --full        also run typecheck and build timings (slow)
//   --skip-perf   skip the API latency probe
//   --load        run the concurrent load test and security probes (minutes)
//   --gate        exit 1 when a load budget or probe fails (for CI or a cron)
//   --no-history  do not append this run to the committed benchmark history

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { apiLatency } from './checks/api-latency.mjs';
import { buildTimings } from './checks/build-timings.mjs';
import { codebaseMetrics } from './checks/codebase.mjs';
import { financePlanChecks } from './checks/finance-plan.mjs';
import { loadTest } from './checks/load.mjs';
import { appendHistory, HISTORY_PATH, hasMeasurements, summarizeRun } from './lib/history.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const reportsDir = join(here, 'reports');
const args = new Set(process.argv.slice(2));

const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, '-');

const report = {
  generatedAt: startedAt.toISOString(),
  flags: {
    full: args.has('--full'),
    skipPerf: args.has('--skip-perf'),
    load: args.has('--load'),
    gate: args.has('--gate'),
  },
  financePlan: financePlanChecks(root),
  codebase: codebaseMetrics(root),
  apiLatency: args.has('--skip-perf') ? { status: 'skipped' } : await apiLatency(),
  build: args.has('--full') ? buildTimings(root) : { status: 'skipped' },
  load: args.has('--load') ? await loadTest() : { status: 'skipped' },
};

function loadPrevious() {
  if (!existsSync(reportsDir)) return null;
  const files = readdirSync(reportsDir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const last = files.at(-1);
  return last ? JSON.parse(readFileSync(join(reportsDir, last), 'utf8')) : null;
}

const delta = (now, before) =>
  now == null || before == null ? null : Math.round((now - before) * 10) / 10;

function diffAgainst(prev) {
  if (!prev) return null;
  const prevStatus = Object.fromEntries(prev.financePlan.map((c) => [c.id, c.status]));
  const statusChanges = report.financePlan
    .filter((c) => prevStatus[c.id] && prevStatus[c.id] !== c.status)
    .map((c) => ({ id: c.id, claim: c.claim, from: prevStatus[c.id], to: c.status }));

  const cb = report.codebase;
  const pb = prev.codebase;
  const latency = {};
  for (const [name, now] of Object.entries(report.apiLatency.endpoints ?? {})) {
    const before = prev.apiLatency?.endpoints?.[name];
    if (now.p95Ms != null && before?.p95Ms != null) {
      latency[name] = {
        p95Ms: { now: now.p95Ms, before: before.p95Ms, delta: delta(now.p95Ms, before.p95Ms) },
      };
    }
  }

  return {
    since: prev.generatedAt,
    statusChanges,
    loc: delta(cb.loc.total, pb.loc.total),
    apiEndpoints: delta(cb.surface.apiEndpointsApprox, pb.surface.apiEndpointsApprox),
    mcpTools: delta(cb.surface.mcpToolsApprox, pb.surface.mcpToolsApprox),
    testCases: delta(cb.tests.casesApprox, pb.tests.casesApprox),
    debt: Object.fromEntries(Object.keys(cb.debt).map((k) => [k, delta(cb.debt[k], pb.debt[k])])),
    latency,
  };
}

function renderMarkdown(diff) {
  const f = report.financePlan;
  const cb = report.codebase;
  const lines = [];
  lines.push(`# Weekly platform analysis, ${report.generatedAt.slice(0, 10)}`);
  lines.push('');
  lines.push(
    `Git: \`${cb.git.branch}\` @ \`${cb.git.head}\`. Dirty: ${cb.git.dirty.modified} modified, ${cb.git.dirty.deleted} deleted, ${cb.git.dirty.untracked} untracked.`,
  );
  lines.push('');

  const current = f.filter((c) => c.kind === 'current');
  const targets = f.filter((c) => c.kind === 'target');
  const changed = current.filter((c) => c.status === 'changed');
  lines.push('## Finance plan');
  lines.push('');
  lines.push(
    `Current-state claims: ${current.length - changed.length} hold, ${changed.length} changed. Target gaps: ${targets.filter((t) => t.status === 'done').length} done, ${targets.filter((t) => t.status === 'open').length} open.`,
  );
  lines.push('');
  lines.push('| id | status | claim | evidence |');
  lines.push('| --- | --- | --- | --- |');
  for (const c of f) lines.push(`| ${c.id} | ${c.status} | ${c.claim} | \`${c.evidence}\` |`);
  lines.push('');

  lines.push('## Codebase');
  lines.push('');
  lines.push(`- LOC (repo source, excl. tests and generated): ${cb.loc.total}`);
  lines.push(`- Test files: ${cb.tests.files}, test cases (approx): ${cb.tests.casesApprox}`);
  lines.push(
    `- API endpoints (approx): ${cb.surface.apiEndpointsApprox}, MCP tools (approx): ${cb.surface.mcpToolsApprox}, migrations: ${cb.surface.migrations}`,
  );
  lines.push(
    `- Debt in services/api/src: any ${cb.debt.anyTypes}, \`as never\` ${cb.debt.neverCasts}, \`as unknown as\` ${cb.debt.doubleCasts}, TODO/FIXME ${cb.debt.todos}`,
  );
  lines.push('');

  lines.push('## API latency');
  lines.push('');
  if (report.apiLatency.status === 'ok') {
    lines.push(
      `Base \`${report.apiLatency.base}\`, ${report.apiLatency.samples} samples per endpoint.`,
    );
    lines.push('');
    lines.push('| endpoint | status | p50 ms | p95 ms | p99 ms | errors |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const [name, e] of Object.entries(report.apiLatency.endpoints)) {
      if (e.status === 'skipped') lines.push(`| ${name} | skipped | - | - | - | ${e.note} |`);
      else
        lines.push(
          `| ${name} | ${Object.keys(e.statuses).join(', ')} | ${e.p50Ms} | ${e.p95Ms} | ${e.p99Ms} | ${e.errors} |`,
        );
    }
  } else {
    lines.push(`Skipped: ${report.apiLatency.status}. ${report.apiLatency.note ?? ''}`.trim());
  }
  lines.push('');

  if (report.build.status !== 'skipped') {
    lines.push('## Build');
    lines.push('');
    for (const [name, t] of Object.entries(report.build)) {
      if (name === 'webClientBytes') lines.push(`- web client bytes: ${t ?? 'not built'}`);
      else
        lines.push(
          `- ${name}: ${t.status}, ${t.seconds}s${t.status === 'failed' ? ` (exit ${t.exitCode})` : ''}`,
        );
    }
    lines.push('');
  }

  if (report.load.status !== 'skipped') {
    const L = report.load;
    lines.push('## Load and probes');
    lines.push('');
    if (L.status !== 'ok') {
      lines.push(`Skipped: ${L.status}. ${L.note ?? ''}`.trim());
    } else {
      lines.push(
        `${L.seconds}s measured per stage, concurrency ${L.levels.join(', ')}. p95 budget checked at ${L.budgetAt}. ${L.failures} budget or probe failure(s).`,
      );
      lines.push('');
      lines.push(
        '| scenario | concurrency | rps | p50 ms | p95 ms | p99 ms | error rate | statuses |',
      );
      lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
      for (const s of L.stages) {
        lines.push(
          `| ${s.scenario} | ${s.concurrency} | ${s.rps} | ${s.p50Ms} | ${s.p95Ms} | ${s.p99Ms} | ${s.errorRate} | ${
            Object.entries(s.statuses)
              .map(([k, v]) => `${k}×${v}`)
              .join(' ') || '-'
          } |`,
        );
      }
      lines.push('');
      lines.push('| probe | expected | result | failures |');
      lines.push('| --- | --- | --- | --- |');
      for (const p of L.probes) {
        lines.push(
          `| ${p.name} | ${p.expect.join('/')} | ${p.pass ? 'pass' : 'FAIL'} | ${p.failures} |`,
        );
      }
      const broken = L.budgets.filter((b) => !b.pass);
      if (broken.length) {
        lines.push('');
        lines.push('Budgets over the line:');
        for (const b of broken)
          lines.push(`- ${b.scenario} ${b.metric}: ${b.actual} (limit ${b.limit})`);
      }
    }
    lines.push('');
  }

  lines.push('## Change since last report');
  lines.push('');
  if (!diff) {
    lines.push('No previous report. This run is the baseline.');
  } else {
    lines.push(`Compared with ${diff.since}.`);
    lines.push('');
    lines.push(`- Finance claims changing status: ${diff.statusChanges.length}`);
    for (const s of diff.statusChanges) lines.push(`  - ${s.id} ${s.claim}: ${s.from} -> ${s.to}`);
    lines.push(`- LOC delta: ${diff.loc}`);
    lines.push(
      `- API endpoint delta: ${diff.apiEndpoints}, MCP tool delta: ${diff.mcpTools}, test case delta: ${diff.testCases}`,
    );
    lines.push(
      `- Debt delta: ${Object.entries(diff.debt)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')}`,
    );
    for (const [name, l] of Object.entries(diff.latency)) {
      lines.push(
        `- ${name} p95: ${l.p95Ms.before} ms -> ${l.p95Ms.now} ms (${l.p95Ms.delta >= 0 ? '+' : ''}${l.p95Ms.delta})`,
      );
    }
  }
  lines.push('');
  return lines.join('\n');
}

const previous = loadPrevious();
const diff = diffAgainst(previous);

mkdirSync(reportsDir, { recursive: true });
const jsonPath = join(reportsDir, `${stamp}.json`);
const mdPath = join(reportsDir, `${stamp}.md`);
writeFileSync(jsonPath, `${JSON.stringify({ ...report, diff }, null, 2)}\n`);
writeFileSync(mdPath, renderMarkdown(diff));

// Benchmarks go into the committed history, not just the gitignored report.
// Skipped when the run measured nothing, so codebase-only runs add no noise.
const historyEntry = summarizeRun(report);
if (hasMeasurements(historyEntry) && !args.has('--no-history')) {
  appendHistory(root, historyEntry);
  console.log(`Benchmark history appended: ${HISTORY_PATH}`);
}

const changed = report.financePlan.filter(
  (c) => c.kind === 'current' && c.status === 'changed',
).length;
console.log(`Analysis written:\n  ${mdPath}\n  ${jsonPath}`);
console.log(
  `Finance claims changed: ${changed}. Build failures: ${Object.values(report.build).filter((t) => t?.status === 'failed').length}.`,
);

const buildFailed = Object.values(report.build).some((t) => t?.status === 'failed');
const loadFailed = report.load.status === 'ok' && report.load.failures > 0;
const loadUnreachable = report.load.status === 'unreachable';

if (report.load.status !== 'skipped') {
  console.log(
    `Load: ${report.load.status === 'ok' ? `${report.load.failures} budget or probe failure(s)` : report.load.status}.`,
  );
}

// Build breakage always fails. Load failures fail only with --gate, so a noisy
// laptop does not break a casual run.
const gateFailed = args.has('--gate') && (loadFailed || loadUnreachable);
process.exitCode = buildFailed || gateFailed ? 1 : 0;
