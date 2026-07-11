/**
 * MCP rate limiter — per-user sliding window of 5 requests/second.
 * Returns HTTP 429 when the limit is exceeded.
 */
const userBuckets = new Map<string, number[]>();

const MAX_REQUESTS_PER_SEC = 5;
const WINDOW_MS = 1000;

export function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const bucket = userBuckets.get(userId) ?? [];

  // Remove timestamps outside the current window
  const recent = bucket.filter((ts) => now - ts < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS_PER_SEC) {
    return true;
  }

  recent.push(now);
  userBuckets.set(userId, recent);
  return false;
}

/** Clean up stale entries periodically to prevent memory leak */
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS * 2;
    for (const [userId, bucket] of userBuckets) {
      const fresh = bucket.filter((ts) => ts > cutoff);
      if (fresh.length === 0) {
        userBuckets.delete(userId);
      } else {
        userBuckets.set(userId, fresh);
      }
    }
  }, 60_000);
}
