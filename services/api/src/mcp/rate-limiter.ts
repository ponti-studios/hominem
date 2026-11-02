import { createHash } from 'node:crypto';

export const MCP_RATE_LIMIT = { limit: 30, windowSec: 1 } as const;
const INCREMENT_SCRIPT = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  return count
`;

function rateLimitKey(userId: string) {
  const identifier = createHash('sha256').update(userId).digest('hex').slice(0, 32);
  return `ratelimit:mcp:${identifier}`;
}

// Rate limit goes through shared Redis so it's consistent across API processes/deployments.
// 'unavailable' is reported separately from 'limited' so the route can fail closed on it,
// while auth/scope checks still always run at the route boundary.
export type RateLimitResult = 'allowed' | 'limited' | 'unavailable';

export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  try {
    const { redis } = await import('@hominem/services/redis');
    const count = Number(
      await redis.eval(INCREMENT_SCRIPT, 1, rateLimitKey(userId), String(MCP_RATE_LIMIT.windowSec)),
    );
    return count > MCP_RATE_LIMIT.limit ? 'limited' : 'allowed';
  } catch {
    return 'unavailable';
  }
}
