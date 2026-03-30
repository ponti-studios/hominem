import {
  buildAuthVerifyHref,
  resolveAuthVerifyEmailParam,
} from '../../utils/navigation/auth-route-params';

describe('auth router', () => {
  it('builds the verify route href from a normalized email', () => {
    expect(buildAuthVerifyHref('  USER@Example.com ')).toBe(
      '/(auth)/verify?email=user%40example.com',
    );
  });

  it('hydrates the verify route email from deep link params', () => {
    expect(resolveAuthVerifyEmailParam('mobile-route@hominem.test')).toBe(
      'mobile-route@hominem.test',
    );
    expect(resolveAuthVerifyEmailParam(['  USER@Example.com ', 'ignored@hominem.test'])).toBe(
      'user@example.com',
    );
    expect(resolveAuthVerifyEmailParam(undefined)).toBeNull();
  });
});
