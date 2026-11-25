import { describe, expect, it } from 'vitest';

import { handleCallback } from './callback.js';

describe('handleCallback', () => {
  it('returns the code when the state matches', () => {
    expect(handleCallback('/callback?state=s&code=abc', 's')).toEqual({
      kind: 'code',
      code: 'abc',
    });
  });

  it('ignores a request with the wrong state instead of aborting sign-in', () => {
    expect(handleCallback('/callback?state=evil&code=abc', 's')).toEqual({ kind: 'ignore' });
  });

  it('ignores a matching-state request that has no code', () => {
    expect(handleCallback('/callback?state=s', 's')).toEqual({ kind: 'ignore' });
  });

  it('ignores other paths', () => {
    expect(handleCallback('/favicon.ico', 's')).toEqual({ kind: 'ignore' });
  });

  it('fails when Google reports an error for our state', () => {
    expect(handleCallback('/callback?state=s&error=access_denied', 's')).toEqual({
      kind: 'fail',
      reason: 'Google returned access_denied',
    });
  });

  it('identifies Hominem errors without changing the Google default', () => {
    expect(handleCallback('/callback?state=s&error=access_denied', 's', 'Hominem')).toEqual({
      kind: 'fail',
      reason: 'Hominem returned access_denied',
    });
  });

  it('does not let an error with the wrong state abort sign-in', () => {
    expect(handleCallback('/callback?state=evil&error=access_denied', 's')).toEqual({
      kind: 'ignore',
    });
  });
});
