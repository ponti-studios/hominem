import { expect, test } from 'vitest';

import { summarize, toCases, type RawResult } from './normalize';

const row = (id: string, overrides: Partial<RawResult> = {}): RawResult => ({
  success: true,
  score: 1,
  latencyMs: 100,
  cost: 0.01,
  testCase: { description: id, metadata: { category: 'x' } },
  response: { tokenUsage: { prompt: 10, completion: 5 } },
  ...overrides,
});

test('groups repeated trials per case and computes pass@1 and pass^k', () => {
  const cases = toCases(
    [row('a'), row('a', { success: false, score: 0 }), row('b'), row('b')],
    ['a', 'b'],
  );
  expect(cases.map((c) => [c.id, c.passRate, c.passAll])).toEqual([
    ['a', 0.5, false],
    ['b', 1, true],
  ]);
});

test('provider errors are infrastructure, not model failures', () => {
  const cases = toCases([row('a', { success: false, failureReason: 2, error: 'boom' })], ['a']);
  expect(cases[0]?.errored).toEqual(true);
  expect(summarize(cases).errors).toEqual(1);
});

test('a failed assertion carries its reason but is not an error', () => {
  const cases = toCases(
    [row('a', { success: false, failureReason: 1, error: 'wrong answer' })],
    ['a'],
  );
  expect(cases[0]?.errored).toEqual(false);
  expect(cases[0]?.passRate).toEqual(0);
});

test('a case with no result at all is flagged rather than silently dropped', () => {
  expect(toCases([], ['missing'])[0]?.errored).toEqual(true);
});

test('summary totals cost, tokens and latency percentiles', () => {
  const summary = summarize(toCases([row('a'), row('b', { latencyMs: 900 })], ['a', 'b']));
  expect(summary).toMatchObject({
    costUsd: 0.02,
    promptTokens: 20,
    completionTokens: 10,
    latencyP95Ms: 900,
  });
});
