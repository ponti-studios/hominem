import { AppState, type AppStateStatus } from 'react-native';

import { logger } from '@hominem/telemetry';

import { posthog } from './posthog';

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
