interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();

  constructor(private options: RateLimitOptions) {}

  get maxRequests() {
    return this.options.maxRequests;
  }

  isAllowed(identifier: string): {
    allowed: boolean;
    resetTime: number;
    remaining: number;
  } {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      const resetTime = now + this.options.windowMs;
      this.store.set(identifier, { count: 1, resetTime });
      return {
        allowed: true,
        resetTime,
        remaining: this.options.maxRequests - 1,
      };
    }

    if (entry.count >= this.options.maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        resetTime: entry.resetTime,
        remaining: 0,
      };
    }

    // Increment count
    entry.count++;
    this.store.set(identifier, entry);

    return {
      allowed: true,
      resetTime: entry.resetTime,
      remaining: this.options.maxRequests - entry.count,
    };
  }

  // Clean up expired entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  reset() {
    this.store.clear();
  }
}

export const resumeConvertRateLimit = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3, // 3 resume conversions per 15 minutes
});

// Cleanup every 5 minutes
setInterval(
  () => {
    resumeConvertRateLimit.cleanup();
  },
  5 * 60 * 1000,
);

export function getRateLimitHeaders(
  result: ReturnType<RateLimiter['isAllowed']>,
  limiter = resumeConvertRateLimit,
) {
  return {
    'X-RateLimit-Limit': String(limiter.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
  };
}
