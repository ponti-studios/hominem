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
