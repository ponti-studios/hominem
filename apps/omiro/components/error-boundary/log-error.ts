import { logger } from '@hominem/telemetry';
import NewRelic from 'newrelic-react-native-agent';
import type { ErrorInfo } from 'react';

import { isNewRelicEnabled } from '~/services/observability';

export function logError(
  error: Error,
  errorInfo?: ErrorInfo,
  context?: {
    feature?: string;
    route?: string;
  },
) {
  logger.error('[ErrorBoundary]', error);
  if (isNewRelicEnabled) {
    const safeError = new Error('Application error');
    safeError.name = 'ApplicationError';
    safeError.stack = error.stack?.split('\n').slice(1, 21).join('\n');
    NewRelic.recordError(safeError, false, {
      feature: context?.feature ?? 'unknown',
      routeAvailable: Boolean(context?.route),
      componentStackAvailable: Boolean(errorInfo?.componentStack),
    });
  }
}
