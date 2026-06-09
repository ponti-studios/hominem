import {} from '@hominem/env';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useEffect, type ReactNode } from 'react';

import { getClientEnv } from './env.client';

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const env = getClientEnv();
  const publicKey = env.VITE_POSTHOG_PUBLIC_KEY;
  const host = env.VITE_POSTHOG_HOST;

  if (!publicKey) {
    // No PostHog public key: render children directly; useFeatureFlag returns false.
    return <>{children}</>;
  }

  useEffect(() => {
    posthog.init(publicKey, {
      api_host: host,
      // Disable in development unless a public key is explicitly set
      loaded: (ph) => {
        if (import.meta.env.DEV && !publicKey) {
          ph.opt_out_capturing();
        }
      },
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false,
    });
  });

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
