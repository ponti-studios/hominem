import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { hominemAuth, refreshHominemToken, type HominemToken } from './hominem-auth.js';

describe('Hominem OAuth', () => {
  it('signs in with a loopback callback, PKCE, and an offline finance grant', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hominem-oauth-login-test-'));
    const path = join(dir, 'token.json');
    let challenge = '';
    let redirectUri = '';
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = input.toString();
      if (url.endsWith('/.well-known/oauth-authorization-server')) {
        return Response.json({
          authorization_endpoint: 'https://api.test/authorize',
          token_endpoint: 'https://api.test/token',
          registration_endpoint: 'https://api.test/register',
        });
      }
      if (url.endsWith('/register')) {
        const registration = JSON.parse(String(init?.body));
        redirectUri = registration.redirect_uris[0];
        expect(registration.scope).toBe('finance:read finance:write');
        expect(init?.redirect).toBe('error');
        return Response.json({ client_id: 'synthetic-client' });
      }
      if (url.endsWith('/token')) {
        const params = new URLSearchParams(String(init?.body));
        expect(params.get('grant_type')).toBe('authorization_code');
        expect(params.get('code')).toBe('fixture-code');
        expect(params.get('redirect_uri')).toBe(redirectUri);
        expect(createHash('sha256').update(params.get('code_verifier')!).digest('base64url')).toBe(
          challenge,
        );
        expect(init?.redirect).toBe('error');
        return Response.json({
          access_token: 'fixture-access',
          refresh_token: 'fixture-refresh',
          expires_in: 3600,
          token_type: 'Bearer',
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    try {
      vi.stubEnv('HOMINEM_API_URL', 'https://api.test');
      await hominemAuth({
        fetchImpl,
        path,
        openUrlImpl: async (url) => {
          const authorize = new URL(url);
          challenge = authorize.searchParams.get('code_challenge')!;
          expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
          expect(authorize.searchParams.get('scope')).toContain('offline_access');
          const callback = new URL(redirectUri);
          callback.searchParams.set('state', authorize.searchParams.get('state')!);
          callback.searchParams.set('code', 'fixture-code');
          expect((await fetch(callback)).status).toBe(200);
        },
      });
      expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({
        client_id: 'synthetic-client',
        access_token: 'fixture-access',
        refresh_token: 'fixture-refresh',
      });
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    } finally {
      vi.unstubAllEnvs();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('refreshes an OAuth login and stores the rotated token privately', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hominem-oauth-test-'));
    const path = join(dir, 'token.json');
    const token: HominemToken = {
      api_url: 'https://api.test',
      token_endpoint: 'https://api.test/token',
      client_id: 'synthetic-client',
      access_token: 'fixture-access',
      refresh_token: 'fixture-refresh',
      expires_at: 0,
    };
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            access_token: 'fixture-new-access',
            refresh_token: 'fixture-new-refresh',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
          { status: 200 },
        ),
    );
    try {
      const refreshed = await refreshHominemToken(token, { fetchImpl, path, now: 1000 });
      expect(refreshed).toMatchObject({
        access_token: 'fixture-new-access',
        refresh_token: 'fixture-new-refresh',
        expires_at: 3_601_000,
      });
      expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(refreshed);
      expect((await stat(path)).mode & 0o777).toBe(0o600);
      const [, request] = fetchImpl.mock.calls[0];
      expect(request?.redirect).toBe('error');
      expect(String(request?.body)).toContain('grant_type=refresh_token');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('refuses to send refresh credentials to a different origin', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      refreshHominemToken(
        {
          api_url: 'https://api.test',
          token_endpoint: 'https://other.test/token',
          client_id: 'synthetic-client',
          access_token: 'fixture-access',
          refresh_token: 'fixture-refresh',
          expires_at: 0,
        },
        { fetchImpl },
      ),
    ).rejects.toThrow('different origin');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
