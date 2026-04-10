import { logError } from '~/components/error-boundary/error-boundary/log-error';

jest.mock('@hominem/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock('~/services/posthog', () => ({
  posthog: {
    captureException: jest.fn(),
  },
}));

describe('logError', () => {
  it('captures errors through the shared logger and analytics sink', () => {
    const error = new Error('boom');
    const { logger } = jest.requireMock('@hominem/utils/logger') as {
      logger: { error: jest.Mock };
    };
    const { posthog } = jest.requireMock('~/services/posthog') as {
      posthog: { captureException: jest.Mock };
    };

    logError(error, undefined, { feature: 'Voice' });

    expect(logger.error).toHaveBeenCalledWith('[ErrorBoundary]', error);
    expect(posthog.captureException).toHaveBeenCalledWith(error, {
      feature: 'Voice',
      route: null,
      userId: null,
    });
  });
});
