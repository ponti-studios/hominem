# Stage 1: Fix the User Identity in E2E Data Seeding

**Kills 4 birds with one stone: seeded transactions, accounts seeded, export CSV (indirect), mobile smoke**

## Root Cause

The `callFinanceE2e` function in `fixtures.ts` calls the API directly at
`http://api.lvh.me:4040/api/finance/e2e/seed` using `page.request.post()`.
This bypasses the `installFinanceApiAuthRoute` proxy (which only intercepts
`http://finance.lvh.me:4444/api/finance/**`). The session cookie from the
sign-in flow IS present (page.request.post includes browser cookies), but
the e2e route middleware I wrote creates a **mock user identity** that
overwrites the real session-authenticated userId with a fallback
`'e2e-test-user'`.

Meanwhile, the finance app's API calls go through the proxy which adds
a random `x-user-id` (from `crypto.randomUUID()` in the fixture). The
`authJwtMiddleware` on the parent Hono app correctly extracts the real
userId from the session cookie — but my mock middleware **overwrites** it.

**Result**: Data is seeded for `'e2e-test-user'` while the finance app
fetches for the real session user. No seeded transaction text appears,
the accounts page sees zero data, and the export button finds no
transactions to download.

## The Fix

**File**: `services/api/src/rpc/routes/finance.e2e.ts`

Replace the mock auth middleware with the standard `authMiddleware`:

```ts
export const financeE2eRoutes = new Hono<AppContext>()
  .use('*', e2eGuard, authMiddleware)  // ← authMiddleware (not mock)
  .post('/reset', async (c) => { ... })
  .post('/seed', async (c) => { ... })
```

This is the correct chain:
1. `authJwtMiddleware` (parent Hono app, runs first) → reads session cookie
   → sets `c.set('userId', ...)` from the better-auth session
2. `e2eGuard` → validates `x-e2e-auth-secret` header
3. `authMiddleware` → asserts `c.get('userId')` exists (set by step 1)
4. Handler → seeds data for the **real** session-authenticated user

## Why This Works

- `page.request.post()` from the test includes the session cookie (set during
  the sign-in flow)
- `betterAuthServer.api.getSession()` in `authJwtMiddleware` finds the session
  and extracts the real user ID
- The seed creates data for this real user ID
- The finance app's API calls include the same session cookie (via the proxy's
  `...route.request().headers()` passthrough)
- The finance app fetches data for the same user → "Whole Foods Market" appears

## Impact

| Test | Status After Fix |
|------|-----------------|
| seeded transactions | ✅ "Whole Foods Market" visible |
| accounts seeded | ✅ "Your Accounts" heading visible |
| export CSV | ✅ Transactions loaded → download fires |
| mobile smoke | ✅ Transactions visible on mobile |

**Cleanup**: Also remove the `User` import and `createMiddleware` usage
that was added for the mock, and restore the original `authMiddleware` import.
