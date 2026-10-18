import { describe, expect, it } from 'vitest';

import { apiSchema } from './env.schema';

describe('apiSchema OTLP logs endpoint', () => {
  it('treats an empty sample value as unset', () => {
    expect(apiSchema.shape.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT.parse('')).toBeUndefined();
  });

  it('accepts a configured URL', () => {
    expect(
      apiSchema.shape.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT.parse(
        'https://otlp.eu01.nr-data.net:4318/v1/logs',
      ),
    ).toBe('https://otlp.eu01.nr-data.net:4318/v1/logs');
  });
});

describe('apiSchema PostHog flag settings', () => {
  it('uses the US host when the host is unset or empty, and takes a given one', () => {
    expect(apiSchema.shape.POSTHOG_HOST.parse(undefined)).toBe('https://us.i.posthog.com');
    expect(apiSchema.shape.POSTHOG_HOST.parse('')).toBe('https://us.i.posthog.com');
    expect(apiSchema.shape.POSTHOG_HOST.parse('https://eu.i.posthog.com')).toBe(
      'https://eu.i.posthog.com',
    );
  });

  it('leaves the key unset when it is not given', () => {
    expect(apiSchema.shape.POSTHOG_API_KEY.parse(undefined)).toBeUndefined();
  });
});
