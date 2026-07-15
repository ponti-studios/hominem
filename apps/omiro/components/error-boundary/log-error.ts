import { logger } from '@hominem/telemetry';
import * as Sentry from '@sentry/react-native';
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
  logger.error('[ErrorBoundary]', error);
  Sentry.captureException(error, {
    contexts: {
      react: {
        componentStack: errorInfo?.componentStack ?? undefined,
      },
    },
    tags: {
      feature: context?.feature ?? 'unknown',
      route: context?.route ?? 'unknown',
    },
  });

  if (typeof posthog.captureException === 'function') {
    posthog.captureException(error, {
      feature: context?.feature ?? null,
      route: context?.route ?? null,
      userId: context?.userId ?? null,
    });
  }
}
