import { beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  API_URL: 'https://api.hominem.test',
}));

vi.mock('../env', () => ({
  env: envMock,
}));

import {
  buildBetterAuthUrl,
  copyHeadersWithSetCookie,
  ensureTrustedOrigin,
  getClientIp,
} from './auth-helpers';

describe('auth route helpers', () => {
  beforeEach(() => {
    envMock.API_URL = 'https://api.hominem.test';
  });

  it('prefers the first forwarded client ip', () => {
    const clientIp = getClientIp({
      req: {
        header: (name: string) =>
          name === 'x-forwarded-for' ? '198.51.100.10, 203.0.113.3' : undefined,
      },
    });

    expect(clientIp).toBe('198.51.100.10');
  });

  it('falls back to x-real-ip and then unknown', () => {
    expect(
      getClientIp({
        req: {
          header: (name: string) => (name === 'x-real-ip' ? '203.0.113.55' : undefined),
        },
      }),
    ).toBe('203.0.113.55');

    expect(
      getClientIp({
        req: {
          header: () => undefined,
        },
      }),
    ).toBe('unknown');
  });

  it('preserves multiple set-cookie headers when copying', () => {
    const headers = new Headers({
      'content-type': 'application/json',
    });

    Object.assign(headers, {
      getSetCookie: () => ['a=1; Path=/; HttpOnly', 'b=2; Path=/; Secure'],
    });

    const copied = copyHeadersWithSetCookie(headers);

    expect(copied.get('content-type')).toBe('application/json');
    expect(copied.getSetCookie()).toEqual(['a=1; Path=/; HttpOnly', 'b=2; Path=/; Secure']);
  });

  it('builds better auth urls with optional path override and preserved query', () => {
    const request = new Request('http://localhost/api/auth/device?user_code=abc123');

    expect(
      buildBetterAuthUrl({
        request,
      }).toString(),
    ).toBe('https://api.hominem.test/api/auth/device');

    expect(
      buildBetterAuthUrl({
        request,
        path: '/device/approve',
        preserveQuery: true,
      }).toString(),
    ).toBe('https://api.hominem.test/api/auth/device/approve?user_code=abc123');
  });

  it('adds a trusted origin only when one is missing', () => {
    const headers = new Headers();

    ensureTrustedOrigin(headers);
    expect(headers.get('origin')).toBe('https://api.hominem.test');

    headers.set('origin', 'https://notes.hominem.test');
    ensureTrustedOrigin(headers);
    expect(headers.get('origin')).toBe('https://notes.hominem.test');
  });
});
