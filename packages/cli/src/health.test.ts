import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { GoogleAuthError } from './google.js';
import { describeHealth, exitCodeFor, healthFromError, shouldNotify } from './health.js';

describe('healthFromError', () => {
  it.each(['TOKEN_MISSING', 'TOKEN_REVOKED', 'API_UNAUTHORIZED'] as const)('%s is dead', (code) => {
    expect(healthFromError(new GoogleAuthError(code, 'x')).status).toBe('dead');
  });

  it.each(['NETWORK', 'API_FAILED', 'REFRESH_FAILED'] as const)(
    '%s is unreachable, not dead',
    (code) => {
      expect(healthFromError(new GoogleAuthError(code, 'x')).status).toBe('unreachable');
    },
  );

  it('treats an unreadable token file as dead', () => {
    expect(healthFromError(new ZodError([])).status).toBe('dead');
    expect(healthFromError(new SyntaxError('bad json')).status).toBe('dead');
  });

  it('treats anything unexpected as unreachable', () => {
    expect(healthFromError(new Error('boom'))).toEqual({ status: 'unreachable', reason: 'boom' });
  });
});

describe('exit codes and notifications', () => {
  it('maps healthy/dead/unreachable to 0/1/2', () => {
    expect(exitCodeFor({ status: 'healthy' })).toBe(0);
    expect(exitCodeFor({ status: 'dead', reason: 'x' })).toBe(1);
    expect(exitCodeFor({ status: 'unreachable', reason: 'x' })).toBe(2);
  });

  it('only notifies when the token is dead, so being offline stays quiet', () => {
    expect(shouldNotify({ status: 'dead', reason: 'x' })).toBe(true);
    expect(shouldNotify({ status: 'unreachable', reason: 'x' })).toBe(false);
    expect(shouldNotify({ status: 'healthy' })).toBe(false);
  });

  it('tells you how to sign back in only when dead', () => {
    expect(describeHealth({ status: 'dead', reason: 'x' }).join('\n')).toContain(
      'hominem auth google',
    );
    expect(describeHealth({ status: 'unreachable', reason: 'x' }).join('\n')).not.toContain(
      'auth google',
    );
  });
});
