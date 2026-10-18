import { describe, expect, it } from 'vitest';

import { reviewSignInCode } from './review-account';

const on = { APP_REVIEW_EMAIL: 'Review@Ponti.io', APP_REVIEW_CODE: 'x'.repeat(24) };
const off = { APP_REVIEW_EMAIL: '', APP_REVIEW_CODE: '' };

describe('reviewSignInCode', () => {
  it('gives the fixed code to the review address for sign-in, ignoring case and spaces', () => {
    expect(reviewSignInCode(on, { email: ' review@ponti.io ', type: 'sign-in' })).toBe(
      on.APP_REVIEW_CODE,
    );
  });
  it('gives nothing to any other address', () => {
    expect(reviewSignInCode(on, { email: 'other@ponti.io', type: 'sign-in' })).toBeUndefined();
    expect(
      reviewSignInCode(on, { email: 'review@ponti.io.evil.com', type: 'sign-in' }),
    ).toBeUndefined();
  });
  it('gives nothing for other flows', () => {
    expect(
      reviewSignInCode(on, { email: 'review@ponti.io', type: 'forget-password' }),
    ).toBeUndefined();
    expect(
      reviewSignInCode(on, { email: 'review@ponti.io', type: 'email-verification' }),
    ).toBeUndefined();
  });
  it('is off unless both values are set', () => {
    expect(reviewSignInCode(off, { email: 'review@ponti.io', type: 'sign-in' })).toBeUndefined();
    expect(
      reviewSignInCode(
        { ...on, APP_REVIEW_CODE: '' },
        { email: 'review@ponti.io', type: 'sign-in' },
      ),
    ).toBeUndefined();
    expect(
      reviewSignInCode({ ...on, APP_REVIEW_EMAIL: '' }, { email: '', type: 'sign-in' }),
    ).toBeUndefined();
  });
});
