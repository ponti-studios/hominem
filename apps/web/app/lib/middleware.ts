import { createContext, redirect, type RouterContext } from 'react-router';

import { getServerSession, type User } from './auth.server';
import { serverEnv } from './env.server';
import { hostedLoginUrl } from './hosted-auth.server';
import { legacyPathFor, type LegacyApp } from './legacy-redirects';

export const userContext = createContext<User | null>(null);

type MiddlewareContext = {
  get: <T>(key: RouterContext<T>) => T;
  set: <T>(key: RouterContext<T>, value: T) => void;
};

type SharedMiddlewareArgs = {
  request: Request;
  context: MiddlewareContext;
};

type SharedMiddlewareNext = () => Promise<Response>;

function isApiRequest(path: string): boolean {
  return path === '/api' || path.startsWith('/api/');
}

function unauthorizedResponse(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (isApiRequest(path)) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  return redirect(hostedLoginUrl(url.pathname + url.search));
}

function parseHosts(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

let legacyHostIndex: Map<string, LegacyApp> | null = null;

function legacyHostMap(): Map<string, LegacyApp> {
  if (!legacyHostIndex) {
    legacyHostIndex = new Map();
    for (const host of parseHosts(serverEnv.LEGACY_FINANCE_HOSTS)) {
      legacyHostIndex.set(host, 'finance');
    }
    for (const host of parseHosts(serverEnv.LEGACY_CAREER_HOSTS)) {
      legacyHostIndex.set(host, 'career');
    }
  }
  return legacyHostIndex;
}

// Retired standalone apps keep their hostnames pointed at the platform for a
// soak period; every request is permanently redirected to its new path.
export function legacyHostRedirectMiddleware(
  { request }: SharedMiddlewareArgs,
  next: SharedMiddlewareNext,
): Response | Promise<Response | void> {
  const url = new URL(request.url);
  const app = legacyHostMap().get(url.hostname.toLowerCase());
  if (!app) return next();

  const target = new URL(legacyPathFor(app, url.pathname), serverEnv.PUBLIC_APP_URL);
  target.search = url.search;

  return redirect(target.toString(), {
    status: 301,
    headers: {
      'Cache-Control': 'no-store',
      // A previously installed service worker on the retired origin must not
      // keep serving its cached shell instead of following the redirect.
      'Clear-Site-Data': '"cache"',
    },
  });
}

export async function sessionMiddleware(
  { request, context }: SharedMiddlewareArgs,
  next: SharedMiddlewareNext,
): Promise<Response | void> {
  if (new URL(request.url).pathname === '/health') {
    return next();
  }

  const { user, headers } = await getServerSession(request);
  if (user) {
    context.set(userContext, user);
  }

  const response = await next();
  for (const setCookie of headers.getSetCookie()) response.headers.append('set-cookie', setCookie);
  return response;
}

export async function requireAuthMiddleware(
  { request, context }: SharedMiddlewareArgs,
  next: SharedMiddlewareNext,
): Promise<Response | void> {
  const user = context.get(userContext);

  if (!user) {
    return unauthorizedResponse(request);
  }

  return next();
}
