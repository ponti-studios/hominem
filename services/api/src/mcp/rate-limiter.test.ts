import { describe, expect, it } from 'vitest';
import { isRateLimited } from './rate-limiter';

const userId = 'test-user-1';

describe('rate limiter', () => {
  it('allows up to 5 requests per second', () => {
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited(userId)).toBe(false);
    }
  });

  it('blocks the 6th request within the same window', () => {
    // Previous test already consumed 5 slots
    expect(isRateLimited(userId)).toBe(true);
  });

  it('tracks different users independently', () => {
    const otherUser = 'test-user-2';
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited(otherUser)).toBe(false);
    }
    expect(isRateLimited(otherUser)).toBe(true);
  });

  it('allows requests after the window resets', async () => {
    const freshUser = 'test-user-3';

    // Consume all 5 slots
    for (let i = 0; i < 5; i++) {
      isRateLimited(freshUser);
    }

    // Wait for window to pass
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Should be allowed again
    expect(isRateLimited(freshUser)).toBe(false);
  }, 3000);
});
