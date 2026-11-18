// HTTP latency probe for a running API. Sequential requests, so the numbers
// reflect one-at-a-time latency, not throughput under load.
//
// Public endpoints are always probed. Authenticated finance endpoints run only
// when ANALYSIS_SESSION_COOKIE is set (a test-account session cookie, from the
// hominem-auth-e2e flow). Without it they are reported as skipped, not measured,
// so a 401 never shows up as real latency.
//
// Env:
//   ANALYSIS_API_URL          default http://localhost:4040
//   ANALYSIS_SAMPLES          requests per endpoint, default 50
//   ANALYSIS_SESSION_COOKIE   optional Cookie header value for authed routes

const PUBLIC_ENDPOINTS = [
  { name: 'healthz', path: '/healthz' },
  { name: 'status', path: '/api/status' },
];

const AUTHED_ENDPOINTS = [
  { name: 'finance.accounts.all', path: '/api/finance/accounts/all' },
  { name: 'finance.transactions.list', path: '/api/finance/transactions/list?limit=50' },
];

const WARMUP = 5;

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[Math.max(0, idx)] * 10) / 10;
}

async function probe(url, headers, samples) {
  const timings = [];
  const statuses = {};
  let errors = 0;
  for (let i = 0; i < WARMUP + samples; i += 1) {
    const start = performance.now();
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
      await res.arrayBuffer();
      const elapsed = performance.now() - start;
      statuses[res.status] = (statuses[res.status] ?? 0) + 1;
      if (i >= WARMUP) timings.push(elapsed);
    } catch {
      errors += 1;
    }
  }
  const sorted = [...timings].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    errors,
    statuses,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    maxMs: sorted.length ? Math.round(sorted[sorted.length - 1] * 10) / 10 : null,
  };
}

export async function apiLatency() {
  const base = process.env.ANALYSIS_API_URL ?? 'http://localhost:4040';
  const samples = Number(process.env.ANALYSIS_SAMPLES ?? 50);
  const cookie = process.env.ANALYSIS_SESSION_COOKIE;

  try {
    await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(3_000) });
  } catch {
    return {
      base,
      status: 'unreachable',
      note: 'start the API (pnpm dev:api) or set ANALYSIS_API_URL',
    };
  }

  const endpoints = {};
  for (const ep of PUBLIC_ENDPOINTS) {
    endpoints[ep.name] = await probe(`${base}${ep.path}`, {}, samples);
  }
  for (const ep of AUTHED_ENDPOINTS) {
    endpoints[ep.name] = cookie
      ? await probe(`${base}${ep.path}`, { cookie }, samples)
      : { status: 'skipped', note: 'set ANALYSIS_SESSION_COOKIE to measure' };
  }
  return { base, status: 'ok', samples, endpoints };
}
