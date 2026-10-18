import { describe, expect, it } from 'vitest';

import { reviewSignInCode } from './review-account';

const on = {
  APP_REVIEW_EMAIL: 'Review@Ponti.io',
  APP_REVIEW_CODE: '482915',
  APP_REVIEW_UNTIL: '2026-11-01T00:00:00Z',
};
const now = new Date('2026-10-20T00:00:00Z');
const off = { APP_REVIEW_EMAIL: '', APP_REVIEW_CODE: '', APP_REVIEW_UNTIL: '' };
const signIn = (email: string, env = on, at = now) =>
  reviewSignInCode(env, { email, type: 'sign-in' }, at);

describe('reviewSignInCode', () => {
  it('gives the fixed code to the review address for sign-in, ignoring case and spaces', () => {
    expect(signIn(' review@ponti.io ')).toBe('482915');
  });
  it('gives nothing to any other address', () => {
    expect(signIn('other@ponti.io')).toBeUndefined();
    expect(signIn('review@ponti.io.evil.com')).toBeUndefined();
  });
  it('gives nothing for other flows', () => {
    expect(
      reviewSignInCode(on, { email: 'review@ponti.io', type: 'forget-password' }, now),
    ).toBeUndefined();
    expect(
      reviewSignInCode(on, { email: 'review@ponti.io', type: 'email-verification' }, now),
    ).toBeUndefined();
  });
  it('stops at the expiry', () => {
    expect(signIn('review@ponti.io', on, new Date('2026-11-01T00:00:00Z'))).toBeUndefined();
    expect(signIn('review@ponti.io', on, new Date('2026-10-31T23:59:59Z'))).toBe('482915');
  });
  it('is off unless address, code and a valid expiry are all set', () => {
    expect(signIn('review@ponti.io', off)).toBeUndefined();
    expect(signIn('review@ponti.io', { ...on, APP_REVIEW_CODE: '' })).toBeUndefined();
    expect(signIn('review@ponti.io', { ...on, APP_REVIEW_UNTIL: '' })).toBeUndefined();
    expect(signIn('review@ponti.io', { ...on, APP_REVIEW_UNTIL: 'soon' })).toBeUndefined();
  });
});
