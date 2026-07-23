import { logger } from '@hominem/telemetry';
import * as Sentry from '@sentry/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { APP_ENV } from '~/constants';

import { posthog } from './posthog';

const isSentryEnabled = APP_ENV === 'production';

if (isSentryEnabled) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: process.env.APP_ENV ?? 'development',
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
  });
}

function flushPostHog() {
  posthog.flush().catch((error) => {
    logger.error('[PostHog] Flush failed:', error);
  });
}

export const initObservability = () => {
  const handleAppStateChange = (state: AppStateStatus) => {
    if (state === 'background') {
      flushPostHog();
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);

  return () => {
    subscription.remove();
    flushPostHog();
  };
};
