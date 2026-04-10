import type { ErrorInfo } from 'react';

import { posthog } from '~/services/posthog';

export function logError(
  error: Error,
  errorInfo?: ErrorInfo,
  context?: {
    feature?: string;
    route?: string;
    userId?: string;
  },
) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.error('[ErrorBoundary]', error, errorInfo);
    return;
  }

  if (typeof posthog.captureException === 'function') {
    posthog.captureException(error, {
      feature: context?.feature ?? null,
      route: context?.route ?? null,
      userId: context?.userId ?? null,
    });
  }
}