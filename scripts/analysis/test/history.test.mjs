import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  appendHistory,
  hasMeasurements,
  HISTORY_PATH,
  readHistory,
  summarizeRun,
  trend,
} from '../lib/history.mjs';

let dir;
before(() => {
  dir = mkdtempSync(join(tmpdir(), 'analysis-history-'));
});
after(() => {
  rmSync(dir, { recursive: true, force: true });
});

const codebase = {
  git: { head: 'abc1234', branch: 'main', dirty: { modified: 2, deleted: 1, untracked: 3 } },
};

const loadRun = {
  status: 'ok',
  budgetAt: 10,
  failures: 1,
  seconds: 10,
  levels: [1, 10],
  stages: [
    {
      scenario: 'healthz',
      concurrency: 10,
      rps: 3700,
      p50Ms: 2.6,
      p95Ms: 5.1,
      p99Ms: 8.9,
      errorRate: 0,
      requests: 37000,
      statuses: { 200: 37000 },
    },
  ],
  probes: [
    { name: 'malformed JSON', pass: false },
    { name: 'unknown route', pass: true },
  ],
};

describe('summarizeRun', () => {
  it('keeps the numbers that matter and drops the rest', () => {
    const entry = summarizeRun({
      generatedAt: '2026-11-16T05:00:00.000Z',
      codebase,
      apiLatency: {
        status: 'ok',
        endpoints: { healthz: { p50Ms: 1, p95Ms: 2, p99Ms: 3, statuses: { 200: 9 } } },
      },
      load: loadRun,
      build: { status: 'skipped' },
    });
    assert.equal(entry.head, 'abc1234');
    assert.equal(entry.api.healthz.p95Ms, 2);
    assert.equal(entry.load.stages[0].rps, 3700);
    assert.equal(
      'statuses' in entry.load.stages[0],
      false,
      'raw status counts stay out of history',
    );
    assert.deepEqual(entry.load.probesFailing, ['malformed JSON']);
    assert.equal(entry.build, null, 'skipped build is not recorded');
  });

  it('records nothing when the API was unreachable', () => {
    const entry = summarizeRun({
      generatedAt: '2026-11-16T05:00:00.000Z',
      codebase,
      apiLatency: { status: 'unreachable' },
      load: { status: 'unreachable' },
    });
    assert.equal(entry.api, null);
    assert.equal(entry.load, null);
  });
});

describe('hasMeasurements', () => {
  it('is false for a codebase-only run, so it is not recorded', () => {
    const entry = summarizeRun({
      generatedAt: '2026-11-16T05:00:00.000Z',
      codebase,
      apiLatency: { status: 'skipped' },
      load: { status: 'skipped' },
      build: { status: 'skipped' },
    });
    assert.equal(hasMeasurements(entry), false);
  });

  it('is true once any benchmark was measured', () => {
    assert.equal(
      hasMeasurements(summarizeRun({ generatedAt: 'x', codebase, load: loadRun })),
      true,
    );
  });
});

describe('append and read', () => {
  it('round-trips entries in order', () => {
    const path = join('scripts', 'analysis', 'history', 'roundtrip.jsonl');
    appendHistory(dir, { at: '1', head: 'a' }, path);
    appendHistory(dir, { at: '2', head: 'b' }, path);
    const back = readHistory(dir, path);
    assert.deepEqual(
      back.map((e) => e.head),
      ['a', 'b'],
    );
  });

  it('skips a malformed line instead of losing the whole history', () => {
    const path = join('scripts', 'analysis', 'history', 'corrupt.jsonl');
    appendHistory(dir, { at: '1', head: 'good' }, path);
    appendFileSync(join(dir, path), '{"at": "trunc\n');
    appendHistory(dir, { at: '3', head: 'also-good' }, path);
    assert.deepEqual(
      readHistory(dir, path).map((e) => e.head),
      ['good', 'also-good'],
    );
  });

  it('returns an empty list when there is no history yet', () => {
    assert.deepEqual(readHistory(dir, join('nope', 'missing.jsonl')), []);
  });

  it('uses the committed path by default', () => {
    assert.equal(HISTORY_PATH, 'scripts/analysis/history/benchmarks.jsonl');
  });
});

describe('trend', () => {
  it('drops runs where the metric was not measured', () => {
    const entries = [
      { at: '1', head: 'a', api: { healthz: { p95Ms: 2 } } },
      { at: '2', head: 'b', api: null },
    ];
    const t = trend(entries, (e) => e.api?.healthz?.p95Ms);
    assert.deepEqual(t, [{ at: '1', head: 'a', value: 2 }]);
  });
});
