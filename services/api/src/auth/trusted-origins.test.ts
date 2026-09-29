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
      WHAT_URL: 'https://what.example.test',
      NEWSBOY_URL: 'https://newsboy.example.test',
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
      WHAT_URL: 'https://what.example.test',
      NEWSBOY_URL: 'https://career.example.test',
    });

    expect(origins.filter((origin) => origin === 'https://career.example.test')).toHaveLength(1);
  });
});
