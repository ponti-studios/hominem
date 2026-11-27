import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { describeError, isNetworkError } from './errors.js';
import { GoogleAuthError } from './google.js';
import { HominemAuthError } from './hominem-auth.js';
import { HominemMcpError } from './hominem.js';
import { WealthError } from './wealth.js';

function withCode(message: string, code: string, cause?: unknown): TypeError {
  return Object.assign(new TypeError(message), { code, ...(cause ? { cause } : {}) });
}

describe('describeError', () => {
  it('keeps the message of errors the user can act on', () => {
    expect(describeError(new HominemAuthError('Sign in first with `hominem auth`.'))).toBe(
      'Sign in first with `hominem auth`.',
    );
    expect(describeError(new HominemMcpError('Tool failed.'))).toBe('Tool failed.');
    expect(describeError(new WealthError('Set STARLING_API_TOKEN to access Starling.'))).toBe(
      'Set STARLING_API_TOKEN to access Starling.',
    );
  });

  it('maps Google auth codes to the command that fixes them', () => {
    expect(describeError(new GoogleAuthError('TOKEN_MISSING', 'missing'))).toContain(
      '`hominem auth google`',
    );
  });

  it('explains a server that cannot be reached instead of calling it unexpected', () => {
    const refused = withCode('ECONNREFUSED: Unable to connect.', 'ECONNREFUSED');
    expect(isNetworkError(refused)).toBe(true);
    expect(describeError(refused)).toBe(
      'hominem: could not reach the server. Check your connection, or run `hominem auth` in a terminal to set the API URL.',
    );
    const wrapped = new TypeError('fetch failed', {
      cause: withCode('getaddrinfo ENOTFOUND', 'ENOTFOUND'),
    });
    expect(isNetworkError(wrapped)).toBe(true);
  });

  it('names the field when the server sends data in an unexpected shape', () => {
    const parsed = z.object({ token: z.string() }).safeParse({ token: 1 });
    if (parsed.success) throw new Error('fixture should fail to parse');
    expect(describeError(parsed.error)).toContain('(at token)');
  });

  it('never prints a raw message for other errors', () => {
    const message = describeError(new Error('secret internals'));
    expect(message).toBe(
      'hominem: unexpected error. Run again with HOMINEM_DEBUG=1 to see the details.',
    );
    expect(message).not.toContain('secret internals');
  });
});
