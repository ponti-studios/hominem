import { describe, expect, it } from 'vitest';

import { legacyPathFor } from './legacy-redirects';

describe('legacy host redirects', () => {
  it.each([
    ['/', '/finance'],
    ['/finance', '/finance'],
    ['/finance/runway', '/finance/runway'],
    ['/analytics', '/finance/analytics'],
    ['/analytics/monthly/2026-10', '/finance/analytics/monthly/2026-10'],
    ['/analytics/tags', '/finance/analytics/tags'],
    ['/accounts', '/finance/accounts'],
    ['/accounts/abc', '/finance/accounts/abc'],
    ['/account', '/settings'],
    ['/auth', '/'],
    ['/auth/verify', '/'],
    ['/something-else', '/finance'],
    ['/finance/', '/finance'],
  ] as const)('finance %s -> %s', (from, to) => {
    expect(legacyPathFor('finance', from)).toBe(to);
  });

  it.each([
    ['/', '/career'],
    ['/profile', '/career/profile'],
    ['/work', '/career/work'],
    ['/work/new', '/career/work/new'],
    ['/projects/abc', '/career/projects/abc'],
    ['/skills', '/career/skills'],
    ['/testimonials', '/career/testimonials'],
    ['/applications/abc/notes', '/career/applications/abc/notes'],
    ['/onboarding', '/career/onboarding'],
    ['/account', '/settings'],
    ['/p/maya-chen', '/p/maya-chen'],
    ['/demo', '/career'],
    ['/prototypes/application-cockpit', '/career'],
    ['/auth', '/'],
    ['/login', '/'],
    ['/unknown', '/career'],
    ['/work/', '/career/work'],
  ] as const)('career %s -> %s', (from, to) => {
    expect(legacyPathFor('career', from)).toBe(to);
  });
});
