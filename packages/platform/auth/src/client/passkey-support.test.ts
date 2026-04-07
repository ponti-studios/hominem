import { describe, expect, it } from 'vitest';

import { hasPasskeySupport } from './passkey-support';

describe('hasPasskeySupport', () => {
  it('returns false without browser passkey APIs', () => {
    expect(hasPasskeySupport(undefined)).toBe(false);
    expect(hasPasskeySupport({ navigator: {} })).toBe(false);
  });

  it('returns false in webdriver environments', () => {
    expect(
      hasPasskeySupport({
        PublicKeyCredential: {},
        navigator: { webdriver: true },
      }),
    ).toBe(false);
  });

  it('returns true when passkey APIs are available outside webdriver', () => {
    expect(
      hasPasskeySupport({
        PublicKeyCredential: {},
        navigator: { webdriver: false },
      }),
    ).toBe(true);
  });
});
