# Stage 2: Forward Set-Cookie Headers in Logout Redirect

**Kills 1 bird: logout test stays on /finance instead of /auth**

## Root Cause

The `createAuthLogoutRoute` handler in `auth-server-routes.ts` calls the
better-auth sign-out API but **discards the response**. The sign-out API
returns `set-cookie` headers that clear the session cookie in the browser.
Without forwarding these headers, the browser's session cookie persists.

After the logout redirect to `/auth`, the auth entry loader calls
`getServerAuth(request)` which fetches `/api/auth/get-session`. Since the
session cookie is still present (not cleared), better-auth returns the
user's session, and `getServerAuth` returns a non-null user. The auth
entry loader then redirects back to `/finance` (the default redirect).

**Result**: The URL appears to stay at `/finance` after navigating to
`/auth/logout`.

## The Fix

**File**: `apps/finance/app/lib/auth-server-routes.ts`

```ts
export function createAuthLogoutRoute(config: ServerRouteConfig) {
  const handler = async ({ request }: { request: Request }) => {
    const res = await fetch(
      new URL('/api/auth/sign-out', config.getApiBaseUrl()).toString(),
      {
        method: 'POST',
        headers: { cookie: request.headers.get('cookie') ?? '' },
      },
    );

    // Forward set-cookie from sign-out response to clear the session
    const headers = new Headers();
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      headers.set('set-cookie', setCookie);
    }

    return redirect('/auth', { headers });
  };
  return { action: handler, loader: handler };
}
```

## Why This Works

1. The browser's `goto('/auth/logout')` triggers the React Router loader
2. The loader calls the better-auth sign-out API with the current session cookie
3. Better-auth clears the session and returns `set-cookie` with expiry in the past
4. The response headers (`set-cookie`) are forwarded to the browser via the
   redirect response
5. The browser clears the session cookie
6. The browser follows the redirect to `/auth`
7. The auth entry loader calls `getServerAuth(request)` — no session cookie →
   returns null → renders the sign-in page
8. The test sees URL matching `/\/auth|\\/$/` ✅

## Impact

| Test | Status After Fix |
|------|-----------------|
| logout | ✅ Redirects to /auth instead of staying on /finance |
