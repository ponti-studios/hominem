// Permanent redirect map for the retired standalone Finance and Career hosts.
// Requests that still arrive on those hostnames are sent to the equivalent
// platform path (docs/web.sub-apps.md, "Cutover").

export type LegacyApp = 'finance' | 'career';

function normalize(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function matches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

const CAREER_PREFIXES = [
  '/work',
  '/projects',
  '/skills',
  '/testimonials',
  '/applications',
] as const;

/** The platform path a retired-host request should land on. */
export function legacyPathFor(app: LegacyApp, pathname: string): string {
  const path = normalize(pathname);

  if (app === 'finance') {
    if (path === '/') return '/finance';
    if (matches(path, '/account')) return '/settings';
    if (matches(path, '/finance') || matches(path, '/analytics') || matches(path, '/accounts')) {
      return matches(path, '/finance') ? path : `/finance${path}`;
    }
    // Auth shims, the old marketing homepage, and anything unknown.
    return matches(path, '/auth') ? '/' : '/finance';
  }

  if (path === '/') return '/career';
  if (matches(path, '/account')) return '/settings';
  if (matches(path, '/profile')) return `/career${path}`;
  if (path === '/onboarding') return '/career/onboarding';
  // The public portfolio URL is unchanged (decision D2).
  if (matches(path, '/p')) return path;
  if (matches(path, '/demo') || matches(path, '/prototypes')) return '/career';
  if (matches(path, '/auth') || path === '/login') return '/';
  if (CAREER_PREFIXES.some((prefix) => matches(path, prefix))) return `/career${path}`;

  return '/career';
}
