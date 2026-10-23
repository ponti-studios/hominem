import type { Context, MiddlewareHandler } from 'hono';

type HeaderCarrier = {
  req: {
    header: (name: string) => string | undefined;
  };
  get?: (key: 'clientIp') => string | undefined;
};

const UNKNOWN_IP = 'unknown';

// Which proxy headers can be believed depends on who can reach us:
// - Behind Cloudflare with the origin guard on (ORIGIN_SECRET set), only Cloudflare can talk to
//   us, so cf-connecting-ip is the real visitor.
// - Otherwise fly-client-ip, which Fly's proxy sets and overwrites, is the only header a visitor
//   can't forge (behind Cloudflare it is the edge IP, so limits are coarse until the guard is on).
// - Outside production there is no proxy, so the old forwarded headers are fine for local dev.
export function clientIpMiddleware(options: {
  originGuardActive: boolean;
  production: boolean;
}): MiddlewareHandler {
  return async (c, next) => {
    c.set('clientIp', resolveClientIp(c, options));
    await next();
  };
}

function resolveClientIp(
  c: Context,
  { originGuardActive, production }: { originGuardActive: boolean; production: boolean },
) {
  const flyIp = c.req.header('fly-client-ip')?.trim();
  if (originGuardActive) {
    const cfIp = c.req.header('cf-connecting-ip')?.trim();
    if (cfIp) return cfIp;
  }
  if (flyIp) return flyIp;
  if (production) return UNKNOWN_IP;

  const realIp = c.req.header('x-real-ip')?.trim();
  if (realIp) return realIp;
  const [first] = (c.req.header('x-forwarded-for') ?? '').split(',');
  return first?.trim() || UNKNOWN_IP;
}

export function getClientIp(c: HeaderCarrier) {
  return c.get?.('clientIp') ?? c.req.header('fly-client-ip')?.trim() ?? UNKNOWN_IP;
}
