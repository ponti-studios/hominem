import type { ErrorInfo } from 'react';

import { logger } from '@hominem/utils/logger';

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

  if (typeof posthog.captureException === 'function') {
    posthog.captureException(error, {
      feature: context?.feature ?? null,
      route: context?.route ?? null,
      userId: context?.userId ?? null,
    });
  }
}
