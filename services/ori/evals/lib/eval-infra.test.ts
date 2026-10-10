import { expect, test } from 'bun:test';

import { EvaluationInfrastructureError, openRouterError, withEvaluationRetry } from './eval-infra';

test('retries only a retryable infrastructure failure', async () => {
  let attempts = 0;
  await withEvaluationRetry(
    async () => {
      attempts += 1;
      if (attempts === 1) throw openRouterError(429, 'rate limited');
    },
    { delayMs: 0 },
  );

  expect(attempts).toEqual(2);
  expect(openRouterError(401, 'unauthorized').retryable).toEqual(false);
  expect(openRouterError(503, 'busy').retryable).toEqual(true);
});

test('does not retry a quality rejection', async () => {
  let attempts = 0;
  let failure = '';
  try {
    await withEvaluationRetry(
      async () => {
        attempts += 1;
        throw new Error('judge rejected the candidate');
      },
      { delayMs: 0 },
    );
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  expect(attempts).toEqual(1);
  expect(failure).toContain('judge rejected the candidate');
  expect(new EvaluationInfrastructureError('provider down', true) instanceof Error).toEqual(true);
});
