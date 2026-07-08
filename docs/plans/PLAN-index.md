# E2E Test Fix Plan — Master Index

## Strategy

**Fix the user identity pipeline** (Stage 1) is the highest-leverage change —
it kills 4 test failures at once by ensuring seeded data belongs to the
correct authenticated user. Every other fix targets a single test.

```
                 ┌─────────────────────┐
                 │  Stage 1            │
                 │  Fix User Identity  │◄──── Kills 4 birds
                 │  (authMiddleware)    │
                 └────────┬────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │ Seeded     │  │ Accounts   │  │ Export CSV │
   │ Txns       │  │ Seeded     │  │ (data dep) │
   └────────────┘  └────────────┘  └────────────┘
          │                                       
          ▼                                       
   ┌────────────┐                                   
   │ Mobile     │                                   
   │ Smoke      │                                   
   └────────────┘                                   

   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │ Stage 2    │  │ Stage 3    │  │ Stage 5    │
   │ Logout     │  │ Runway     │  │ Final Run  │
   │ (1 test)   │  │ (1 test)   │  │ + Version  │
   └────────────┘  └────────────┘  │ Fix        │
                                   └────────────┘
```

## Execution Order

| Order | Stage | Effort | Impact | Dependencies |
|-------|-------|--------|--------|-------------|
| 1 | **Stage 1**: Restore `authMiddleware` in e2e routes | 5 min | 4 tests | None |
| 2 | **Stage 2**: Forward set-cookie on logout | 5 min | 1 test | None |
| 3 | **Stage 5**: Pin React Router versions | 5 min | 0-2 tests (cross-cutting) | None |
| 4 | **Stage 3**: Debug + fix runway | 15-30 min | 1 test | Stage 5 may fix it |
| 5 | Run full test suite | 5 min | All | All above |
| 6 | **Stage 4**: Typecheck cleanup | Optional | N/A | Time permitting |

## Maximum Impact Path

If Stage 1 fixes 4 tests and Stage 2 fixes 1 test, that's **5 additional
passing tests** (12→17). If Stage 5 fixes 1-2 more (runway, export),
that's **6-7 additional passing tests** (12→18-19).

The two skipped tests:
- `passkey.spec.ts:271` — Needs WebAuthn hardware (never runs in CI)
- `plaid-sandbox.spec.ts` — Needs Plaid sandbox credentials

## Key Insight: One Stone, Four Birds

All data-dependent UI tests fail because:
1. `callFinanceE2e` calls the API directly (no proxy, no `x-user-id`)
2. The e2e route mock middleware falls back to `'e2e-test-user'`
3. The finance app API calls go through the proxy with the `authenticatedPage`'s
   random userId (from `crypto.randomUUID()`)
4. **Data seeded for user A, app queries for user B → nothing visible**

The fix: Replace the mock middleware with the real `authMiddleware`. Then
`callFinanceE2e` uses the session cookie (from `page.request.post()`), and
the `authJwtMiddleware` extracts the real session userId from better-auth.
Both the seed and the query use the **same** userId automatically.
