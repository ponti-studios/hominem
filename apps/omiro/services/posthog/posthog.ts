import { PostHog } from 'posthog-react-native';

import { E2E_TESTING } from '~/constants';
import { env } from '~/env';

const apiKey = env.EXPO_PUBLIC_POSTHOG_API_KEY;
const host = env.EXPO_PUBLIC_POSTHOG_HOST;
const disabled = __DEV__ || E2E_TESTING || !apiKey;

function createNoopPostHog() {
  return {
    capture() {},
    captureException() {},
    flush() {
      return Promise.resolve();
    },
    identify() {},
    reset() {},
  };
}

// The real client, or null when analytics are off. The provider needs the real
// type; everything else goes through `posthog`, which falls back to a no-op.
export const posthogClient = disabled
  ? null
  : new PostHog(apiKey, {
      host,
      disabled,
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          // Leave console empty -- PostHogErrorBoundary handles this, so this would double-capture
          console: [],
        },
      },
    });

export const posthog = posthogClient ?? createNoopPostHog();
