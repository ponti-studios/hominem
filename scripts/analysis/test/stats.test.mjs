import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { percentile, summarize } from '../lib/stats.mjs';

describe('percentile (nearest rank)', () => {
  const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('picks the nearest-rank value', () => {
    assert.equal(percentile(ten, 50), 5);
    assert.equal(percentile(ten, 95), 10);
    assert.equal(percentile(ten, 99), 10);
  });

  it('returns null for no samples', () => {
    assert.equal(percentile([], 50), null);
  });

  it('handles a single sample at every percentile', () => {
    assert.equal(percentile([7], 1), 7);
    assert.equal(percentile([7], 100), 7);
  });
});

describe('summarize', () => {
  it('counts a network error and a 5xx as unexpected', () => {
    const results = [
      { ms: 3, status: 200, error: false },
      { ms: 4, status: 500, error: false },
      { ms: 0, status: null, error: true },
    ];
    const s = summarize(results, [200], 1000);
    assert.equal(s.requests, 3);
    assert.equal(s.networkErrors, 1);
    assert.equal(s.unexpected, 2);
    assert.equal(s.errorRate, 0.667);
  });

  it('treats a 200 on a 401-only route as unexpected (a leak)', () => {
    const s = summarize([{ ms: 2, status: 200, error: false }], [401], 1000);
    assert.equal(s.unexpected, 1);
    assert.equal(s.errorRate, 1);
  });

  it('computes requests per second from elapsed time', () => {
    const results = Array.from({ length: 50 }, () => ({ ms: 1, status: 200, error: false }));
    assert.equal(summarize(results, [200], 5000).rps, 10);
  });

  it('reports null latency and error rate when nothing was measured', () => {
    const s = summarize([], [200], 1000);
    assert.equal(s.requests, 0);
    assert.equal(s.p95Ms, null);
    assert.equal(s.errorRate, null);
  });
});
