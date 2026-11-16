// Pure stats for the load runner. No I/O here so the tests can hit it directly.

export const round1 = (n) => Math.round(n * 10) / 10;

// Nearest-rank percentile on an already-sorted array. p in (0, 100].
export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return round1(sorted[idx]);
}

// results: [{ ms, status, error }]. A request is "unexpected" when it hit a
// network error or returned a status outside `expect`. For a 401-only route,
// a 200 is unexpected (a leak), and so is a 5xx.
export function summarize(results, expect, elapsedMs) {
  const requests = results.length;
  const latencies = [];
  const statuses = {};
  let networkErrors = 0;
  let unexpected = 0;

  for (const r of results) {
    if (r.error) {
      networkErrors += 1;
      unexpected += 1;
      continue;
    }
    latencies.push(r.ms);
    statuses[r.status] = (statuses[r.status] ?? 0) + 1;
    if (!expect.includes(r.status)) unexpected += 1;
  }

  latencies.sort((a, b) => a - b);
  return {
    requests,
    rps: requests > 0 && elapsedMs > 0 ? round1(requests / (elapsedMs / 1000)) : 0,
    networkErrors,
    unexpected,
    errorRate: requests > 0 ? Math.round((unexpected / requests) * 1000) / 1000 : null,
    statuses,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    maxMs: latencies.length ? round1(latencies[latencies.length - 1]) : null,
  };
}
