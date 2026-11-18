// Concurrent load test plus hostile-input probes against a running API.
//
// What it does:
//   1. Stages: each scenario runs at every concurrency level (workers hammer the
//      endpoint in parallel). A warmup window is thrown away before measuring.
//   2. Budgets: p95 latency is checked at one concurrency level (the budget
//      level). Error rate is checked at every level. A request counts as an
//      error when it fails the network or returns a status the scenario did not
//      expect. An unauthenticated route that returns 200 is an error, not a win.
//   3. Probes: malformed, oversized, and forged requests, repeated in parallel.
//      They must get a 4xx we expect, never a 5xx, and never a 200 they shouldn't.
//
// Env (all optional):
//   ANALYSIS_API_URL             default http://localhost:4040
//   ANALYSIS_LOAD_CONCURRENCY    comma list, default 1,10,25
//   ANALYSIS_LOAD_SECONDS        measured seconds per stage, default 10
//   ANALYSIS_LOAD_BUDGET_AT      concurrency for the p95 budget, default 10
//   ANALYSIS_SESSION_COOKIE      test-account session cookie; adds authed scenario

import { summarize } from '../lib/stats.mjs';

const WARMUP_MS = 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const PROBE_REPEATS = 5;

// Budgets are ceilings. Tune them after a few real runs, not before.
export const SCENARIOS = [
  {
    name: 'healthz',
    path: '/healthz',
    expect: [200],
    budget: { p95Ms: 50, maxErrorRate: 0 },
  },
  {
    name: 'status',
    path: '/api/status',
    expect: [200],
    budget: { p95Ms: 300, maxErrorRate: 0 },
  },
  {
    // Must reject fast and never leak data. A 200 here is a security failure.
    name: 'finance.transactions.list.unauth',
    path: '/api/finance/transactions/list?limit=50',
    expect: [401],
    budget: { p95Ms: 100, maxErrorRate: 0 },
  },
];

export const AUTHED_SCENARIO = {
  name: 'finance.transactions.list.authed',
  path: '/api/finance/transactions/list?limit=50',
  expect: [200],
  budget: { p95Ms: 800, maxErrorRate: 0 },
  needsCookie: true,
};

export function parseLevels(text) {
  const levels = String(text)
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (levels.length === 0) throw new Error(`no valid concurrency levels in "${text}"`);
  return [...new Set(levels)].sort((a, b) => a - b);
}

async function sendOnce(url, { method = 'GET', headers = {}, body } = {}) {
  const t0 = performance.now();
  try {
    // Only send a body when there is one. Some fetch linters reject body+GET.
    const init = { method, headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
    if (body !== undefined) init.body = body;
    const res = await fetch(url, init);
    await res.arrayBuffer();
    return { ms: performance.now() - t0, status: res.status, error: false };
  } catch (err) {
    // Keep the cause code so a flaky connection can be told apart from a bad status.
    const code = err?.cause?.code ?? err?.name ?? 'error';
    return { ms: performance.now() - t0, status: null, error: String(code) };
  }
}

// Runs `concurrency` workers for `seconds` after warmup. Returns the summary.
export async function runLoad({ url, headers = {}, expect, concurrency, seconds }) {
  const start = performance.now();
  const measureFrom = start + WARMUP_MS;
  const deadline = measureFrom + seconds * 1000;
  const results = [];

  async function worker() {
    while (performance.now() < deadline) {
      const startedAt = performance.now();
      const r = await sendOnce(url, { headers });
      // Keep requests that started after warmup, even if they finish later.
      if (startedAt >= measureFrom) results.push(r);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return { concurrency, ...summarize(results, expect, seconds * 1000) };
}

export async function runProbes(base, { cookie, repeats = PROBE_REPEATS } = {}) {
  const authed = '/api/finance/accounts/all';
  const probes = [
    {
      name: 'unknown route returns 404',
      path: '/api/does-not-exist',
      expect: [404],
    },
    {
      name: 'oversized URL is rejected',
      path: `/api/does-not-exist?q=${'a'.repeat(20_000)}`,
      expect: [400, 413, 414, 431],
    },
    {
      name: 'oversized body is rejected',
      method: 'POST',
      path: '/api/finance/transactions/create',
      headers: { 'content-type': 'application/json' },
      body: 'a'.repeat(2_000_000),
      expect: [413],
    },
    {
      name: 'malformed JSON without auth is rejected',
      method: 'POST',
      path: '/api/finance/transactions/create',
      headers: { 'content-type': 'application/json' },
      body: '{"amount":',
      expect: [401],
    },
    {
      name: 'forged session cookie is rejected',
      path: authed,
      headers: { cookie: 'better-auth.session_token=forged-by-analysis' },
      expect: [401],
    },
  ];

  const out = [];
  for (const p of probes) {
    const sends = Array.from({ length: repeats }, () =>
      sendOnce(`${base}${p.path}`, {
        method: p.method,
        headers: p.headers,
        body: p.body,
      }),
    );
    const results = await Promise.all(sends);
    const statuses = {};
    const errorCodes = {};
    let failures = 0;
    let networkErrors = 0;
    for (const r of results) {
      if (r.error) {
        failures += 1;
        networkErrors += 1;
        errorCodes[r.error] = (errorCodes[r.error] ?? 0) + 1;
        continue;
      }
      statuses[r.status] = (statuses[r.status] ?? 0) + 1;
      if (!p.expect.includes(r.status) || r.status >= 500) failures += 1;
    }
    out.push({
      name: p.name,
      expect: p.expect,
      statuses,
      networkErrors,
      errorCodes,
      failures,
      pass: failures === 0,
    });
  }

  // Authed probe only makes sense when a real cookie is supplied; the forged
  // cookie probe above covers the rejection side without one.
  if (cookie) {
    const r = await sendOnce(`${base}${authed}`, { headers: { cookie } });
    out.push({
      name: 'real session cookie is accepted',
      expect: [200],
      statuses: r.error ? {} : { [r.status]: 1 },
      failures: r.error || r.status !== 200 ? 1 : 0,
      pass: !r.error && r.status === 200,
    });
  }
  return out;
}

// One budget row per (scenario, metric). A missing measurement fails the budget
// instead of passing it silently.
export function evaluateBudgets(scenarios, stages, budgetAt) {
  const rows = [];
  for (const sc of scenarios) {
    const mine = stages.filter((s) => s.scenario === sc.name);
    const atBudget = mine.find((s) => s.concurrency === budgetAt);
    const p95 = atBudget?.p95Ms ?? null;
    rows.push({
      scenario: sc.name,
      metric: `p95Ms@${budgetAt}`,
      limit: sc.budget.p95Ms,
      actual: p95,
      pass: p95 !== null && p95 <= sc.budget.p95Ms,
    });
    for (const s of mine) {
      rows.push({
        scenario: sc.name,
        metric: `errorRate@${s.concurrency}`,
        limit: sc.budget.maxErrorRate,
        actual: s.errorRate,
        pass: s.errorRate !== null && s.errorRate <= sc.budget.maxErrorRate,
      });
    }
  }
  return rows;
}

async function reachable(base) {
  try {
    await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(3_000) });
    return true;
  } catch {
    return false;
  }
}

export async function loadTest(opts = {}) {
  const base = opts.base ?? process.env.ANALYSIS_API_URL ?? 'http://localhost:4040';
  const seconds = opts.seconds ?? Number(process.env.ANALYSIS_LOAD_SECONDS ?? 10);
  const budgetAt = opts.budgetAt ?? Number(process.env.ANALYSIS_LOAD_BUDGET_AT ?? 10);
  const cookie = opts.cookie ?? process.env.ANALYSIS_SESSION_COOKIE;
  const requested = parseLevels(opts.levels ?? process.env.ANALYSIS_LOAD_CONCURRENCY ?? '1,10,25');

  if (!(await reachable(base))) {
    return {
      status: 'unreachable',
      base,
      note: 'start the API (pnpm dev:api) or set ANALYSIS_API_URL',
    };
  }

  // The p95 budget needs a stage at budgetAt, so add that level if it's missing.
  const levels = parseLevels([...requested, budgetAt].join(','));
  const scenarios = cookie ? [...SCENARIOS, AUTHED_SCENARIO] : SCENARIOS;

  const stages = [];
  for (const sc of scenarios) {
    for (const concurrency of levels) {
      const stage = await runLoad({
        url: `${base}${sc.path}`,
        headers: sc.needsCookie ? { cookie } : {},
        expect: sc.expect,
        concurrency,
        seconds,
      });
      stages.push({ scenario: sc.name, ...stage });
    }
  }

  const probes = await runProbes(base, { cookie });
  const budgets = evaluateBudgets(scenarios, stages, budgetAt);
  const failures = budgets.filter((b) => !b.pass).length + probes.filter((p) => !p.pass).length;

  return {
    status: 'ok',
    base,
    seconds,
    levels,
    budgetAt,
    stages,
    probes,
    budgets,
    failures,
  };
}
