import { E2E_TESTING } from '~/constants';

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
const disabled = __DEV__ || E2E_TESTING || !apiKey;
export const POSTHOG_ENABLED = !disabled;

console.warn('[PostHog] boot', {
  e2e: E2E_TESTING,
  dev: __DEV__,
  apiKeyLength: apiKey.length,
  enabled: POSTHOG_ENABLED,
});

if (disabled) {
  console.warn('[PostHog] Analytics disabled — events will not be recorded.', {
    reason: !apiKey ? 'missing EXPO_PUBLIC_POSTHOG_API_KEY' : 'DEV mode',
  });
}

function createNoopPostHog() {
  return {
    capture() {},
    captureException() {},
    flush() {
      return Promise.resolve();
    },
    identify() {},
    reset() {},
  }
}

export const posthog = disabled
  ? createNoopPostHog()
  : (() => {
      const { PostHog } = require('posthog-react-native') as typeof import('posthog-react-native');
      return new PostHog(apiKey, {
        host,
        disabled,
        errorTracking: {
          autocapture: {
            uncaughtExceptions: true,
            unhandledRejections: true,
            // Leave console empty — PostHogErrorBoundary is used, which would double-capture
            console: [],
          },
        },
      });
    })()
