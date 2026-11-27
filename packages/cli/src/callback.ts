// What to do with one request that hit the local OAuth callback server.
export type CallbackAction =
  | { kind: 'ignore' } // not ours: answer 404 and keep waiting
  | { kind: 'code'; code: string }
  | { kind: 'fail'; reason: string };

// Pure on purpose: the server in auth.ts only moves bytes. Requests with the wrong state, or
// no code, are ignored rather than fatal, so a stray local request can't abort your sign-in.
export function handleCallback(
  requestUrl: string,
  expectedState: string,
  provider = 'Google',
): CallbackAction {
  const url = new URL(requestUrl, 'http://127.0.0.1');
  if (url.pathname !== '/callback') return { kind: 'ignore' };
  if (url.searchParams.get('state') !== expectedState) return { kind: 'ignore' };
  const error = url.searchParams.get('error');
  if (error) return { kind: 'fail', reason: `${provider} returned ${error}` };
  const code = url.searchParams.get('code');
  return code ? { kind: 'code', code } : { kind: 'ignore' };
}
