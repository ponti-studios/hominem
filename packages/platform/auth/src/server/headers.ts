export function getSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  return typeof getSetCookie === 'function' ? getSetCookie.call(headers) : [];
}
