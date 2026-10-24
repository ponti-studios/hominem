interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/** Process-local TTL cache. Entries are not shared across workers or servers. */
export class QueryCache {
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  /** Returns undefined for a miss; null is cacheable and expired entries are removed on read. */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp >= entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // The caller owns the value type associated with each string key.
    // oxlint-disable-next-line typescript/consistent-type-assertions
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /** Invalidates keys matching a fresh copy of the pattern. */
  invalidatePattern(pattern: RegExp): void {
    const matcher = new RegExp(pattern.source, pattern.flags.replace('g', ''));
    for (const key of this.cache.keys()) {
      if (matcher.test(key)) this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  /** Counts expired entries until a read removes them or clear() is called. */
  getStats(): { total: number; valid: number; expired: number } {
    const now = Date.now();
    let valid = 0;
    let expired = 0;
    for (const entry of this.cache.values()) {
      if (now - entry.timestamp >= entry.ttl) expired++;
      else valid++;
    }
    return { total: this.cache.size, valid, expired };
  }
}

/** Shared cache for this process; use explicit keys and keep user data scoped. */
export const queryCache = new QueryCache();

/** Default TTLs used by server query callers, in milliseconds. */
export const CACHE_TTL = {
  VERDICT_STATS: 30 * 1000,
  CASE_LIST: 60 * 1000,
  CASE_DETAIL: 30 * 1000,
  USER_SESSION: 5 * 60 * 1000,
} as const;

/** Returns a cached non-undefined result, or loads and stores it; concurrent misses are independent. */
export async function withCache<T>(key: string, fn: () => Promise<T>, ttlMs: number): Promise<T> {
  const cached = queryCache.get<T>(key);
  if (cached !== undefined) return cached;

  const data = await fn();
  queryCache.set(key, data, ttlMs);
  return data;
}

/** Invalidates detail, stats, and list keys affected by a case update. */
export function invalidateCaseCache(caseId: string): void {
  queryCache.invalidate(`case:${caseId}`);
  queryCache.invalidate(`case:${caseId}:stats`);
  queryCache.invalidatePattern(/^cases:/);
}
