import { afterEach, describe, expect, it, vi } from 'vitest';

import { CACHE_TTL, invalidateCaseCache, QueryCache, queryCache, withCache } from './cache';

afterEach(() => {
  queryCache.clear();
  vi.useRealTimers();
});

describe('queryCache', () => {
  it('supports isolated cache instances', () => {
    const cache = new QueryCache();
    cache.set('key', 'value', 100);

    expect(cache.get('key')).toBe('value');
    expect(queryCache.get('key')).toBeUndefined();
  });

  it('returns a stored value until its TTL expires, then removes it on read', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T10:00:00.000Z'));
    queryCache.set('case:1', { id: '1' }, 100);

    expect(queryCache.get<{ id: string }>('case:1')).toEqual({ id: '1' });

    vi.advanceTimersByTime(100);
    expect(queryCache.get('case:1')).toBeUndefined();
    expect(queryCache.getStats()).toEqual({ total: 0, valid: 0, expired: 0 });
  });

  it('counts expired entries until they are read or cleared', () => {
    vi.useFakeTimers();
    queryCache.set('fresh', 'value', 100);
    queryCache.set('stale', 'value', 10);
    vi.advanceTimersByTime(10);

    expect(queryCache.getStats()).toEqual({ total: 2, valid: 1, expired: 1 });
    expect(queryCache.get('stale')).toBeUndefined();
    expect(queryCache.getStats()).toEqual({ total: 1, valid: 1, expired: 0 });
  });

  it('invalidates one key and matching keys with a global regular expression', () => {
    queryCache.set('cases:all', 1, 100);
    queryCache.set('cases:recent', 2, 100);
    queryCache.set('case:1', 3, 100);

    queryCache.invalidatePattern(/^cases:/g);
    queryCache.invalidate('case:1');

    expect(queryCache.get('cases:all')).toBeUndefined();
    expect(queryCache.get('cases:recent')).toBeUndefined();
    expect(queryCache.get('case:1')).toBeUndefined();
  });

  it('clears all cached entries', () => {
    queryCache.set('one', 1, 100);
    queryCache.set('two', 2, 100);

    queryCache.clear();

    expect(queryCache.getStats()).toEqual({ total: 0, valid: 0, expired: 0 });
  });
});

describe('withCache', () => {
  it('loads once and reuses the cached result', async () => {
    const load = vi.fn(async () => ({ count: 3 }));

    await expect(withCache('stats', load, CACHE_TTL.VERDICT_STATS)).resolves.toEqual({ count: 3 });
    await expect(withCache('stats', load, CACHE_TTL.VERDICT_STATS)).resolves.toEqual({ count: 3 });

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed load', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue('ok');

    await expect(withCache('retry', load, 100)).rejects.toThrow('temporary failure');
    await expect(withCache('retry', load, 100)).resolves.toBe('ok');

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('caches null results as successful values', async () => {
    const load = vi.fn(async () => null);

    await expect(withCache('empty-result', load, 100)).resolves.toBeNull();
    await expect(withCache('empty-result', load, 100)).resolves.toBeNull();

    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('invalidateCaseCache', () => {
  it('invalidates detail, stats, and list entries for a case update', () => {
    queryCache.set('case:42', 'detail', 100);
    queryCache.set('case:42:stats', 'stats', 100);
    queryCache.set('cases:all', 'list', 100);
    queryCache.set('case:7', 'other detail', 100);

    invalidateCaseCache('42');

    expect(queryCache.get('case:42')).toBeUndefined();
    expect(queryCache.get('case:42:stats')).toBeUndefined();
    expect(queryCache.get('cases:all')).toBeUndefined();
    expect(queryCache.get('case:7')).toBe('other detail');
  });
});
