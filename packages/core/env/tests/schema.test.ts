import { describe, expect, it } from 'vitest';

import { apiSchema, baseSchema, webSchema } from '../src/index';

describe('schema exports', () => {
  it('exports the shared base schema', () => {
    expect(baseSchema.parse({})).toMatchObject({
      NODE_ENV: 'development',
      AI_PROVIDER: 'openrouter',
      REDIS_URL: 'redis://localhost:6379',
    });
  });

  it('exports the api schema', () => {
    const env = apiSchema.parse({
      RESEND_API_KEY: 'resend-test',
      RESEND_FROM_EMAIL: 'hello@example.com',
      RESEND_FROM_NAME: 'Hakumi',
    });

    expect(env).toMatchObject({
      PORT: '3000',
      API_URL: 'http://localhost:4040',
      NOTES_URL: 'http://localhost:4445',
      RESEND_API_KEY: 'resend-test',
      RESEND_FROM_EMAIL: 'hello@example.com',
      RESEND_FROM_NAME: 'Hakumi',
    });
  });

  it('exports the web schema', () => {
    expect(
      webSchema.parse({
        VITE_PUBLIC_API_URL: 'http://localhost:4040',
      }),
    ).toMatchObject({
      VITE_PUBLIC_API_URL: 'http://localhost:4040',
      VITE_POSTHOG_HOST: 'https://us.i.posthog.com',
    });
  });
});
