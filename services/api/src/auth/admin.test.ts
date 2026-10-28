import { describe, expect, it } from 'vitest';

import { isAdminEmail } from './admin';

describe('isAdminEmail', () => {
  it('matches configured addresses without case or whitespace sensitivity', () => {
    expect(isAdminEmail(' OWNER@example.com ', 'admin@example.com, owner@example.com')).toBe(true);
  });

  it('does not treat a domain as an admin wildcard', () => {
    expect(isAdminEmail('person@example.com', 'example.com')).toBe(false);
  });

  it('returns false for an empty address or empty allowlist', () => {
    expect(isAdminEmail('', 'admin@example.com')).toBe(false);
    expect(isAdminEmail('admin@example.com', '')).toBe(false);
  });
});
