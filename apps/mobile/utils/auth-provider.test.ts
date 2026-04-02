import { extractSuccessfulAuthCallbackUrl } from './auth-provider-result';

describe('extractSuccessfulAuthCallbackUrl', () => {
  it('returns the callback URL for a successful browser result', () => {
    const callbackUrl = extractSuccessfulAuthCallbackUrl({
      type: 'success',
      url: 'hakumi-dev://auth/callback?state=abc&code=token',
    });

    expect(callbackUrl).toBe('hakumi-dev://auth/callback?state=abc&code=token');
  });

  it('throws a cancellable error on cancel or dismiss', () => {
    expect(() => extractSuccessfulAuthCallbackUrl({ type: 'cancel' })).toThrowError(
      expect.objectContaining({
        message: 'OAuth sign-in cancelled',
        name: 'ERR_REQUEST_CANCELED',
      }),
    );

    expect(() => extractSuccessfulAuthCallbackUrl({ type: 'dismiss' })).toThrowError(
      expect.objectContaining({
        message: 'OAuth sign-in cancelled',
        name: 'ERR_REQUEST_CANCELED',
      }),
    );
  });

  it('throws a generic failure when no callback URL is present', () => {
    expect(() => extractSuccessfulAuthCallbackUrl({ type: 'opened' })).toThrow(
      'OAuth sign-in failed',
    );
  });
});
