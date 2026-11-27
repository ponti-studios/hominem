import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { buildAuthUrl, makePkce, SCOPES } from './google.js';

describe('makePkce', () => {
  it('derives the S256 challenge from the verifier', () => {
    const { verifier, challenge } = makePkce();
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
  });

  it('makes a fresh verifier each call', () => {
    expect(makePkce().verifier).not.toBe(makePkce().verifier);
  });
});

describe('buildAuthUrl', () => {
  it('includes Google Tasks in the shared OAuth grant', () => {
    expect(SCOPES).toContain('https://www.googleapis.com/auth/tasks');
  });

  it('requests offline access with the full scope set and PKCE', () => {
    const url = new URL(
      buildAuthUrl({
        client: {
          client_id: 'client-id',
          client_secret: 'secret',
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
        },
        redirectUri: 'http://127.0.0.1:5555/callback',
        state: 'state-value',
        challenge: 'challenge-value',
      }),
    );

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('scope')).toBe(SCOPES.join(' '));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('state-value');
  });
});
