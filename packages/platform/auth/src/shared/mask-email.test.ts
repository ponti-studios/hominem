import { describe, expect, it } from 'vitest';

import { maskEmail } from './mask-email';

describe('maskEmail', () => {
  it('masks standard emails showing first 2 chars', () => {
    expect(maskEmail('monday@example.com')).toBe('mo***@example.com');
  });

  it('masks short local parts (2 chars) showing first char', () => {
    expect(maskEmail('ab@example.com')).toBe('a***@example.com');
  });

  it('masks single-char local parts', () => {
    expect(maskEmail('a@example.com')).toBe('a***@example.com');
  });

  it('returns input unchanged if no @ symbol', () => {
    expect(maskEmail('noemail')).toBe('noemail');
  });

  it('returns input unchanged if @ is first character', () => {
    expect(maskEmail('@domain.com')).toBe('@domain.com');
  });

  it('handles long local parts', () => {
    expect(maskEmail('verylongemail@example.com')).toBe('ve***@example.com');
  });
});
