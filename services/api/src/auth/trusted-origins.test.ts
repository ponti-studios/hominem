import { describe, expect, it } from 'vitest';

import { getTrustedOrigins } from './trusted-origins';

describe('getTrustedOrigins', () => {
  it('includes the configured Newsboy origin', () => {
    const origins = getTrustedOrigins({
      API_URL: 'https://api.example.test',
      CAREER_URL: 'https://career.example.test',
      FINANCE_URL: 'https://finance.example.test',
      WEB_URL: 'https://web.example.test',
      LABS_URL: 'https://labs.example.test',
      LABS_APEX_URL: undefined,
      NEWSBOY_URL: 'https://newsboy.example.test',
      ENV: undefined,
      NODE_ENV: 'test',
      MAESTRO_API_ORIGIN: undefined,
    });

    expect(origins).toContain('https://newsboy.example.test');
  });

  it('deduplicates origins when multiple apps share an origin', () => {
    const origins = getTrustedOrigins({
      API_URL: 'https://api.example.test',
      CAREER_URL: 'https://career.example.test',
      FINANCE_URL: 'https://finance.example.test',
      WEB_URL: 'https://web.example.test',
      LABS_URL: 'https://labs.example.test',
      LABS_APEX_URL: undefined,
      NEWSBOY_URL: 'https://career.example.test',
      ENV: undefined,
      NODE_ENV: 'test',
      MAESTRO_API_ORIGIN: undefined,
    });

    expect(origins.filter((origin) => origin === 'https://career.example.test')).toHaveLength(1);
  });

  it('allows the simulator API origin only for non-production scripted runs', () => {
    const origin = 'http://192.168.1.20:4040';
    const base = {
      API_URL: 'http://localhost:4040',
      CAREER_URL: 'https://career.example.test',
      FINANCE_URL: 'https://finance.example.test',
      WEB_URL: 'https://web.example.test',
      LABS_URL: 'https://labs.example.test',
      LABS_APEX_URL: undefined,
      NEWSBOY_URL: 'https://newsboy.example.test',
      MAESTRO_API_ORIGIN: origin,
    };

    expect(getTrustedOrigins({ ...base, ENV: 'scripted', NODE_ENV: 'development' })).toContain(
      origin,
    );
    expect(getTrustedOrigins({ ...base, ENV: 'scripted', NODE_ENV: 'production' })).not.toContain(
      origin,
    );
    expect(getTrustedOrigins({ ...base, ENV: undefined, NODE_ENV: 'development' })).not.toContain(
      origin,
    );
  });
});
