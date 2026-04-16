import { describe, expect, it } from 'vitest';

import { resolveAuthRedirect } from './redirect-policy';

describe('resolveAuthRedirect', () => {
  it('falls back when redirect is missing', () => {
    expect(resolveAuthRedirect(null, '/notes')).toEqual({
      safeRedirect: '/notes',
      rejectedReason: 'missing',
      rejectedPathname: null,
    });
  });

  it('rejects non-local redirects', () => {
    expect(resolveAuthRedirect('https://evil.example', '/notes', ['/notes'])).toEqual({
      safeRedirect: '/notes',
      rejectedReason: 'non_local',
      rejectedPathname: null,
    });
  });

  it('rejects protocol-relative redirects', () => {
    expect(resolveAuthRedirect('//evil.example', '/notes', ['/notes'])).toEqual({
      safeRedirect: '/notes',
      rejectedReason: 'protocol_relative',
      rejectedPathname: null,
    });
  });

  it('preserves query strings and hashes for allowed redirects', () => {
    expect(resolveAuthRedirect('/notes/inbox?tab=today#top', '/notes', ['/notes'])).toEqual({
      safeRedirect: '/notes/inbox?tab=today#top',
      rejectedReason: null,
      rejectedPathname: null,
    });
  });

  it('rejects disallowed paths', () => {
    expect(resolveAuthRedirect('/admin', '/notes', ['/notes', '/settings'])).toEqual({
      safeRedirect: '/notes',
      rejectedReason: 'disallowed',
      rejectedPathname: '/admin',
    });
  });

  it('normalizes trailing slashes in allowed prefixes', () => {
    expect(resolveAuthRedirect('/notes/archive', '/notes', ['/notes/'])).toEqual({
      safeRedirect: '/notes/archive',
      rejectedReason: null,
      rejectedPathname: null,
    });
  });
});
