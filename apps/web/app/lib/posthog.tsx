import { useEffect, type ReactNode } from 'react';

const apiKey: string | undefined = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
const host: string | undefined = import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com';

/**
 * Posthog only does pageview capture here — nothing reads its React context
 * (no feature flags, no identity hooks), so there is no provider to keep
 * mounted. The library itself is a quarter-megabyte, so it loads on an idle
 * callback after first paint instead of blocking the entry chunk.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    const idle =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback
        : (callback: () => void) => window.setTimeout(callback, 200);
    idle(() => {
      if (cancelled) return;
      void import('posthog-js').then(({ default: posthog }) => {
        if (cancelled) return;
        posthog.init(apiKey, {
          api_host: host,
          capture_pageview: true,
          capture_pageleave: true,
          autocapture: false,
        });
      });
    });
    return cancel;
  }, []);

  return <>{children}</>;
}
