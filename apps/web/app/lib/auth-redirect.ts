export function buildAuthRedirectPath(nextPath: string) {
  return `/auth?next=${encodeURIComponent(nextPath)}`;
}

export function buildAuthRedirectFromUrl(url: URL) {
  return buildAuthRedirectPath(`${url.pathname}${url.search}`);
}
