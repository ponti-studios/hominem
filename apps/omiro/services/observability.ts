import { logger } from '@hominem/telemetry';
import * as Application from 'expo-application';
import NewRelic from 'newrelic-react-native-agent';
import { AppState, type AppStateStatus } from 'react-native';

import { APP_ENV } from '~/constants';
import { env } from '~/env';

import { posthog } from './posthog';

export const isNewRelicEnabled =
  APP_ENV === 'production' && Boolean(env.EXPO_PUBLIC_NEWRELIC_IOS_APP_TOKEN);

if (isNewRelicEnabled) {
  NewRelic.startAgent(env.EXPO_PUBLIC_NEWRELIC_IOS_APP_TOKEN, {
    analyticsEventEnabled: false,
    nativeCrashReportingEnabled: true,
    crashReportingEnabled: true,
    interactionTracingEnabled: true,
    networkRequestEnabled: false,
    networkErrorRequestEnabled: false,
    httpResponseBodyCaptureEnabled: false,
    loggingEnabled: false,
    collectorAddress: 'mobile-collector.eu01.nr-data.net',
    crashCollectorAddress: 'mobile-crash.eu01.nr-data.net',
    jsErrorReportingEnabled: true,
  });
  NewRelic.setJSAppVersion(Application.nativeApplicationVersion ?? '1.0.0');
  NewRelic.setAttribute('environment', APP_ENV);
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
