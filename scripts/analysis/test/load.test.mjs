import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  evaluateBudgets,
  loadTest,
  parseLevels,
  runLoad,
  runProbes,
  SCENARIOS,
} from '../checks/load.mjs';
import { startStub } from './stub-server.mjs';

// Short stages keep the suite quick. Each stage still pays the 1s warmup.
const SECONDS = 0.4;

let stub;
before(async () => {
  stub = await startStub();
});
after(async () => {
  await stub.close();
});

describe('parseLevels', () => {
  it('sorts, dedupes, and drops junk', () => {
    assert.deepEqual(parseLevels('25, 1,10,10'), [1, 10, 25]);
  });

  it('rejects input with no usable levels', () => {
    assert.throws(() => parseLevels('0,abc,-3'), /no valid concurrency levels/);
  });
});

describe('runLoad against the stub', () => {
  it('a healthy route has zero unexpected responses', async () => {
    const s = await runLoad({
      url: `${stub.base}/ok`,
      expect: [200],
      concurrency: 4,
      seconds: SECONDS,
    });
    assert.ok(s.requests > 0, 'should send requests');
    assert.equal(s.errorRate, 0);
    assert.deepEqual(Object.keys(s.statuses), ['200']);
  });

  it('a flaky route (every 3rd is 500) shows roughly a third errors', async () => {
    const s = await runLoad({
      url: `${stub.base}/flaky`,
      expect: [200],
      concurrency: 2,
      seconds: SECONDS,
    });
    assert.ok(s.statuses['500'] > 0, 'the 500s should be counted');
    assert.ok(s.errorRate > 0.2 && s.errorRate < 0.45, `errorRate was ${s.errorRate}`);
  });

  it('a leaking route is flagged when 401 is expected', async () => {
    const s = await runLoad({
      url: `${stub.base}/leaky`,
      expect: [401],
      concurrency: 2,
      seconds: SECONDS,
    });
    assert.equal(s.errorRate, 1, 'every 200 from a leaky route counts as a failure');
  });

  it('a secured route rejects anonymous traffic cleanly', async () => {
    const s = await runLoad({
      url: `${stub.base}/secure`,
      expect: [401],
      concurrency: 2,
      seconds: SECONDS,
    });
    assert.equal(s.errorRate, 0);
  });
});

describe('evaluateBudgets', () => {
  const scenarios = [{ name: 'a', budget: { p95Ms: 10, maxErrorRate: 0 } }];

  it('fails the p95 budget when the budget level was never measured', () => {
    const rows = evaluateBudgets(scenarios, [], 10);
    const p95 = rows.find((r) => r.metric === 'p95Ms@10');
    assert.equal(p95.pass, false, 'a missing measurement must not pass');
  });

  it('fails the error budget on any error at any level', () => {
    const stages = [
      { scenario: 'a', concurrency: 1, p95Ms: 1, errorRate: 0 },
      { scenario: 'a', concurrency: 10, p95Ms: 2, errorRate: 0.01 },
    ];
    const rows = evaluateBudgets(scenarios, stages, 10);
    assert.equal(rows.find((r) => r.metric === 'errorRate@10').pass, false);
    assert.equal(rows.find((r) => r.metric === 'errorRate@1').pass, true);
  });

  it('fails a p95 over the ceiling', () => {
    const stages = [{ scenario: 'a', concurrency: 10, p95Ms: 11, errorRate: 0 }];
    const rows = evaluateBudgets(scenarios, stages, 10);
    assert.equal(rows.find((r) => r.metric === 'p95Ms@10').pass, false);
  });
});

describe('runProbes against the stub', () => {
  it('passes a route that returns the expected 404', async () => {
    const probes = await runProbes(stub.base, { repeats: 3 });
    const unknown = probes.find((p) => p.name === 'unknown route returns 404');
    assert.equal(unknown.pass, true);
  });

  it('flags endpoints that do not reject bad input the way the API should', async () => {
    // The stub answers 404 to these, not the 401/413 the real API returns.
    // That mismatch must show up as a failure, not a pass.
    const probes = await runProbes(stub.base, { repeats: 3 });
    const malformed = probes.find((p) => p.name.startsWith('malformed JSON'));
    const oversized = probes.find((p) => p.name.startsWith('oversized body'));
    assert.equal(malformed.pass, false);
    assert.equal(oversized.pass, false);
    assert.equal(malformed.failures, 3);
  });

  it('records each probe with its repeat count', async () => {
    const probes = await runProbes(stub.base, { repeats: 2 });
    for (const p of probes) {
      const answered = Object.values(p.statuses).reduce((a, b) => a + b, 0);
      // Every send is either answered or a network error. None are dropped.
      assert.equal(answered + p.networkErrors, 2, `${p.name} must account for all 2 sends`);
    }
  });
});

describe('loadTest', () => {
  it('reports unreachable instead of crashing when the API is down', async () => {
    const out = await loadTest({ base: 'http://127.0.0.1:1', seconds: SECONDS });
    assert.equal(out.status, 'unreachable');
  });

  it('runs every scenario at every level and evaluates budgets (stub is not the real API)', async () => {
    const out = await loadTest({
      base: stub.base,
      seconds: SECONDS,
      levels: '1,2',
      budgetAt: 2,
      cookie: undefined,
    });
    assert.equal(out.status, 'ok');
    assert.deepEqual(out.levels, [1, 2]);
    assert.equal(out.stages.length, SCENARIOS.length * 2);
    assert.equal(out.probes.length, 5);
    assert.ok(out.budgets.length > 0);
    // The stub is not a real API, so probes must flag it.
    assert.ok(out.failures > 0, 'a fake API should not pass every probe');
  });
});
