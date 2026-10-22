import { expect, test } from 'vitest';

import { compareToBaseline } from './compare';
import type { CaseRecord, SuiteRecord } from './types';

const entry = (id: string, passRate: number): CaseRecord => ({
  id,
  category: 'c',
  trials: [],
  passRate,
  passAll: passRate === 1,
  errored: false,
});

const suite = (overrides: Partial<SuiteRecord> & { cases: CaseRecord[] }): SuiteRecord => ({
  suite: 's',
  tier: 'regression',
  datasetHash: 'd',
  promptHash: 'p',
  targetModel: 'm',
  judgeModel: 'j',
  trialsPerCase: 1,
  limited: false,
  summary: {
    cases: overrides.cases.length,
    trials: overrides.cases.length,
    passRate: overrides.cases.reduce((sum, c) => sum + c.passRate, 0) / overrides.cases.length,
    passAllRate: 0,
    errors: 0,
    meanScore: 0,
    costUsd: 0,
    promptTokens: 0,
    completionTokens: 0,
    latencyP50Ms: 0,
    latencyP95Ms: 0,
    byCategory: {},
  },
  ...overrides,
});

test('skips the gate without a baseline', () => {
  expect(compareToBaseline(suite({ cases: [entry('a', 1)] })).gate).toEqual('skipped');
});

test('a regression-tier case that used to pass and now fails blocks', () => {
  const comparison = compareToBaseline(
    suite({ cases: [entry('a', 0), entry('b', 1)] }),
    suite({ cases: [entry('a', 1), entry('b', 1)] }),
  );
  expect(comparison.gate).toEqual('fail');
  expect(comparison.regressions).toEqual(['a']);
});

test('known failures and fixes do not block the regression tier', () => {
  const comparison = compareToBaseline(
    suite({ cases: [entry('a', 0), entry('b', 1), entry('c', 1)] }),
    suite({ cases: [entry('a', 0), entry('b', 0), entry('c', 1)] }),
  );
  expect(comparison.gate).toEqual('pass');
  expect(comparison.knownFailures).toEqual(['a']);
  expect(comparison.fixes).toEqual(['b']);
});

test('capability tier tolerates small drops and fails on large ones', () => {
  const base = suite({
    tier: 'capability',
    cases: Array.from({ length: 10 }, (_, i) => entry(`c${i}`, 1)),
  });
  const small = suite({
    tier: 'capability',
    cases: Array.from({ length: 10 }, (_, i) => entry(`c${i}`, i === 0 ? 0 : 1)),
  });
  const large = suite({
    tier: 'capability',
    cases: Array.from({ length: 10 }, (_, i) => entry(`c${i}`, i < 3 ? 0 : 1)),
  });
  expect(compareToBaseline(small, base).gate).toEqual('pass');
  expect(compareToBaseline(large, base).gate).toEqual('fail');
});

test.each([
  ['dataset', { datasetHash: 'x' }],
  ['prompt', { promptHash: 'x' }],
  ['target model', { targetModel: 'x' }],
  ['judge model', { judgeModel: 'x' }],
  ['partial run', { limited: true }],
])('does not gate when the %s differs from the baseline', (_name, change) => {
  const comparison = compareToBaseline(
    suite({ cases: [entry('a', 0)], ...change }),
    suite({ cases: [entry('a', 1)] }),
  );
  expect(comparison.comparable).toEqual(false);
  expect(comparison.gate).toEqual('skipped');
});
