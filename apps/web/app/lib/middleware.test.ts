import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./env.server', () => ({
  serverEnv: {
    PUBLIC_APP_URL: 'https://app.example',
    LEGACY_FINANCE_HOSTS: 'finance.example, finance-alias.example',
    LEGACY_CAREER_HOSTS: 'career.example',
    HOMINEM_INTERNAL_API_URL: 'https://api.example',
  },
}));

import { legacyHostRedirectMiddleware } from './middleware';

const context = new RouterContextProvider();

function run(url: string) {
  return legacyHostRedirectMiddleware({ request: new Request(url), context }, () =>
    Promise.resolve(new Response('platform')),
  );
}

describe('legacy host redirect middleware', () => {
  it('redirects a retired finance host and preserves the query', async () => {
    const response = await run('https://finance.example/analytics/monthly/2026-10?tag=food');

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(301);
    expect((response as Response).headers.get('location')).toBe(
      'https://app.example/finance/analytics/monthly/2026-10?tag=food',
    );
    expect((response as Response).headers.get('clear-site-data')).toBe('"cache"');
    expect((response as Response).headers.get('cache-control')).toBe('no-store');
  });

  it('redirects a retired career host to the career sub-app', async () => {
    const response = await run('https://career.example/applications/abc/notes');

    expect((response as Response).status).toBe(301);
    expect((response as Response).headers.get('location')).toBe(
      'https://app.example/career/applications/abc/notes',
    );
  });

  it('keeps the public portfolio URL unchanged', async () => {
    const response = await run('https://career.example/p/maya-chen');

    expect((response as Response).headers.get('location')).toBe('https://app.example/p/maya-chen');
  });

  it('matches aliases and ignores the port', async () => {
    const response = await run('https://finance-alias.example:8443/accounts/abc');

    expect((response as Response).headers.get('location')).toBe(
      'https://app.example/finance/accounts/abc',
    );
  });

  it('lets the platform host through untouched', async () => {
    const response = await run('https://app.example/finance');

    expect(await (response as Response).text()).toBe('platform');
  });
});
