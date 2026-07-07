# Stage 5: Full E2E Test Run and Verification

**Kills all remaining birds by validating the complete test suite passes**

## Step 1: Pin React Router to Matching Versions

**Likely root cause of 1-2 remaining failures (runway, CSV export)**

The `@react-router/dev` (build-time compiler) is `7.14.0` while `react-router`
(runtime) is `7.15.1`. This mismatch can cause:

| Symptom | Likely Mechanism |
|---------|-----------------|
| Loader/action not called | Build-time codegen uses 7.14 API patterns; runtime 7.15 may defer or skip |
| Form `requestSubmit` failure | Changed behavior of `<form>` method submission between versions |
| RPC client fetch errors | Changed internal fetch wrapper signatures |
| Redirect ignored | Changed redirect/response handling |

**Fix**: Align both packages in `apps/finance/package.json`:

```json
{
  "react-router": "7.14.0",
  "@react-router/dev": "7.14.0"
}
```

After updating, run `pnpm install` and restart both servers.

## Step 2: Apply Fixes from Stages 1-3

1. **Stage 1**: Restore `authMiddleware` in e2e routes
2. **Stage 2**: Forward `set-cookie` on logout redirect
3. **Stage 3**: Fix runway (whatever the investigation reveals)

## Step 3: Restart Servers

```bash
# Kill existing
kill $(lsof -ti :4040 2>/dev/null)
kill $(lsof -ti :4444 2>/dev/null)

# Start API
cd /path/to/monorepo && pnpm --filter @hominem/api dev &
sleep 8

# Start Finance App
cd apps/finance && VITE_PUBLIC_API_URL=http://api.lvh.me:4444 npx react-router dev --host 0.0.0.0 --port 4444 &
sleep 15
```

## Step 4: Run All Playwright Tests

```bash
cd apps/finance
AUTH_E2E_SECRET=otp-secret \
FINANCE_E2E_AUTH_SECRET=otp-secret \
REUSE_SERVERS=true \
npx playwright test --headed
```

## Expected Results

| Test | Status |
|------|--------|
| auth.email-otp.spec.ts (2 tests) | ✅ Already passing |
| auth.passkey.spec.ts (6 tests, 1 skip) | ✅ Already passing |
| finance.journeys.spec.ts:3 (unauthenticated) | ✅ Already passing |
| finance.journeys.spec.ts:11 (empty dashboard) | ✅ Already passing |
| finance.journeys.spec.ts:24 (seeded txns) | ✅ **Fixed by Stage 1** |
| finance.journeys.spec.ts:46 (accounts seeded) | ✅ **Fixed by Stage 1** |
| finance.journeys.spec.ts:62 (analytics) | ✅ Already passing |
| finance.journeys.spec.ts:81 (runway) | ✅ **Fixed by Stage 3** |
| finance.journeys.spec.ts:96 (CSV import) | ✅ Already passing |
| finance.journeys.spec.ts:123 (export CSV) | ✅ **Fixed by Stage 1** (data loaded → download fires) |
| finance.journeys.spec.ts:151 (logout) | ✅ **Fixed by Stage 2** |
| homepage.spec.ts | ✅ Already passing |
| mobile-smoke.spec.ts | ✅ **Fixed by Stage 1** |
| plaid-sandbox.spec.ts | 🟡 Skipped (needs Plaid sandbox) |

## Step 5: Fallback — If Tests Still Fail

If some tests still fail after Stage 5 Step 1:

1. **Run a single failing test with trace**:
   ```bash
   npx playwright test tests/finance.journeys.spec.ts --headed --trace=on --grep "runway"
   npx playwright show-trace test-results/*/trace.zip
   ```

2. **Run with DEBUG logging**:
   ```bash
   DEBUG=pw:api,pw:browser npx playwright test tests/finance.journeys.spec.ts --headed
   ```

3. **Check API logs** during test run for auth errors or 500s:
   ```bash
   tail -f /tmp/api-server.log | grep -E "error|500|401|403"
   ```
