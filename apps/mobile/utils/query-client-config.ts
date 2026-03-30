import type { DefaultOptions } from '@tanstack/react-query';

export const QUERY_PERSISTENCE_STRATEGY = 'disabled';

export function shouldRetryQuery(failureCount: number, error: Error | Response): boolean {
  if (failureCount > 3) {
    return false;
  }

  if ('status' in error && typeof error.status === 'number') {
    return false;
  }
  return true;
}

/**
 * Returns an exponential-backoff retry-delay function capped at `maxMs`.
 * Used to create per-concern delay functions with different caps (queries vs chats).
 */
export function makeRetryDelay(maxMs: number): (attemptIndex: number) => number {
  const safeMaxMs = Number.isFinite(maxMs) ? Math.max(0, maxMs) : 0;

  return (attemptIndex: number) => {
    const normalizedAttempt = Number.isFinite(attemptIndex)
      ? Math.max(0, Math.floor(attemptIndex))
      : 0;

    const delayMs = 1000 * 2 ** normalizedAttempt;
    return Math.min(delayMs, safeMaxMs);
  };
}

export const getQueryRetryDelayMs = makeRetryDelay(30_000);

export const mobileQueryDefaultOptions: DefaultOptions = {
  queries: {
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: shouldRetryQuery,
    retryDelay: getQueryRetryDelayMs,
    networkMode: 'offlineFirst',
  },
  mutations: {
    retry: 1,
    networkMode: 'offlineFirst',
  },
};
