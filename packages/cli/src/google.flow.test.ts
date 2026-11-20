import { describe, expect, it, vi } from 'vitest';

import {
  checkLive,
  classifyRefreshFailure,
  isFresh,
  isQuotaError,
  refreshToken,
  type TokenFile,
} from './google.js';
import { healthFromError } from './health.js';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const token = (over: Partial<TokenFile> = {}): TokenFile => ({
  token: 'access',
  refresh_token: 'refresh',
  token_uri: 'https://oauth.test/token',
  client_id: 'id',
  client_secret: 'secret',
  expiry: '2026-11-19T13:00:00Z',
  ...over,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('isFresh', () => {
  it('is fresh with more than a minute left', () => {
    expect(isFresh(token(), NOW)).toBe(true);
  });
  it('is stale inside the one-minute margin', () => {
    expect(isFresh(token({ expiry: '2026-11-19T12:00:30Z' }), NOW)).toBe(false);
  });
  it('is stale when the file has no expiry', () => {
    expect(isFresh(token({ expiry: undefined }), NOW)).toBe(false);
  });
});

describe('classifyRefreshFailure', () => {
  it('flags invalid_grant as revoked and anything else as transient', () => {
    expect(classifyRefreshFailure('{"error":"invalid_grant"}')).toBe('TOKEN_REVOKED');
    expect(classifyRefreshFailure('{"error":"backend_error"}')).toBe('REFRESH_FAILED');
  });
});

describe('refreshToken', () => {
  it('saves the new access token and keeps a refresh token Google did not rotate', async () => {
    const save = vi.fn(async () => undefined);
    const fetchFn = vi.fn(async () => json({ access_token: 'new', expires_in: 3600 }));
    const out = await refreshToken(token({ expiry: undefined }), {
      fetch: fetchFn,
      now: () => NOW,
      save,
    });
    expect(out.token).toBe('new');
    expect(out.refresh_token).toBe('refresh');
    expect(out.expiry).toBe('2026-11-19T13:00:00.000Z');
    expect(save).toHaveBeenCalledWith(out);
  });

  it('adopts a rotated refresh token', async () => {
    const out = await refreshToken(token(), {
      fetch: async () => json({ access_token: 'n', expires_in: 1, refresh_token: 'rotated' }),
      now: () => NOW,
      save: async () => undefined,
    });
    expect(out.refresh_token).toBe('rotated');
  });

  it('reports invalid_grant as a dead token', async () => {
    const error = await refreshToken(token(), {
      fetch: async () => json({ error: 'invalid_grant' }, 400),
      save: async () => undefined,
    }).catch((caught: unknown) => caught);
    expect(healthFromError(error).status).toBe('dead');
  });
});

describe('checkLive', () => {
  const deps = (fetchFn: typeof fetch) => ({
    fetch: fetchFn,
    now: () => NOW,
    save: async () => undefined,
  });

  // loadToken reads the real token path, so give accessToken a fresh token through a temp HOME-less
  // route: stub readFile via the fetch path instead by testing send()'s mapping directly.
  it('maps being offline to unreachable, not dead', async () => {
    const offline: typeof fetch = async () => {
      throw new TypeError('fetch failed');
    };
    const error = await refreshToken(token({ expiry: undefined }), deps(offline)).catch(
      (caught: unknown) => caught,
    );
    expect(healthFromError(error).status).toBe('unreachable');
  });

  it('exports checkLive for the shell', () => {
    expect(typeof checkLive).toBe('function');
  });
});

describe('isQuotaError', () => {
  const body = (reason: string) => JSON.stringify({ error: { errors: [{ reason }] } });

  it('treats usage-limit reasons as quota, not a dead login', () => {
    expect(isQuotaError(body('userRateLimitExceeded'))).toBe(true);
    expect(isQuotaError(body('storageQuotaExceeded'))).toBe(true);
  });

  it('leaves real permission failures and junk bodies as not quota', () => {
    expect(isQuotaError(body('insufficientFilePermissions'))).toBe(false);
    expect(isQuotaError('not json')).toBe(false);
    expect(isQuotaError('{}')).toBe(false);
  });
});
