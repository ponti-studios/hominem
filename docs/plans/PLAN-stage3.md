# Stage 3: Fix the Runway Calculation Result Not Rendering

**Kills 1 bird: runway test**

## Root Cause Investigation Required

The runway test fills "Initial Balance" and "Monthly Expenses" inputs,
clicks "Calculate Runway", but the "Runway (Months)" summary card never
appears. The component conditionally renders this card only when
`chartData.length > 0`, which depends on the `runwayMutation.data`
returning a response with `projectionData`.

### Possible Causes (ordered by likelihood)

1. **API mutation never fires** — The `handleInputChange` auto-triggers
   `runwayMutation.mutate()` on input change, but Playwright's `fill()`
   may not trigger React's synthetic `onChange` event. The manual
   `calculateButton.click()` should fire `handleCalculateRunway` which
   also calls `runwayMutation.mutate()`. Need to verify the button click
   actually triggers the handler.

2. **API call fails** — The RPC client posts to `POST /api/finance/runway/calculate`
   with `credentials: 'include'`. The `authJwtMiddleware` on the API checks
   the session via `betterAuthServer.api.getSession()`. If the session
   cookie isn't forwarded correctly by the Playwright proxy, the API
   returns an auth error. The mutation catches the error silently.

3. **Component doesn't re-render** — After the mutation completes, React
   should update `runwayMutation.data` which triggers `useMemo` to recompute
   `chartData`. If the mutation's `onSuccess` handler doesn't trigger a
   re-render, the card stays hidden.

4. **React Router / Recharts version mismatch** — The `react-router@7.15.1`
   vs `@react-router/dev@7.14.0` mismatch (see Stage 5) could cause
   client-side routing or hydration issues.

### Investigation Steps

1. **Test the API directly** — Send a POST to the runway calculate
   endpoint with the session cookie to verify it returns data:

```bash
# Step 1: Sign in via better-auth and capture the session cookie
# Step 2: Send the runway calculation request
curl -X POST http://api.lvh.me:4040/api/finance/runway/calculate \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"balance":12000,"monthlyExpenses":3100}'
```

2. **Add a console.log in the handleCalculateRunway handler** to confirm
   the button click fires and the mutation is called.

3. **Check the Playwright proxy** — The RPC client makes requests to
   `http://api.lvh.me:4040/api/finance/...` (cross-origin). The
   `installFinanceApiAuthRoute` proxy intercepts `http://finance.lvh.me:4444/api/finance/**`
   only. Since the RPC client uses the API's origin directly, the proxy
   doesn't intercept these requests. The `credentials: 'include'` flag
   in the RPC client should send the session cookie cross-origin, but
   verify the cookie is actually present in the request.

### Likely Fix

If the issue is the Playwright proxy not intercepting the RPC calls
(because they go directly to api.lvh.me:4040 not through the proxy),
the `x-user-id` header is not added. But the session cookie IS sent
via `credentials: 'include'`. The fix would be **stage 5** — the version
mismatch may be causing the RPC client's fetch not to work correctly.

Alternatively, if the button click handler fires but the API returns
an error, the fix could be in the runway API route's middleware chain.
