# Auth Workflow Tools Log - Chronological

This is a chronological record of the exact commands and browser actions used while working through the auth plan, the API cleanup path, and the Web auth journey fixes.

## 1. Read the auth plan before editing

- Read `docs/auth-test-journeys.md` to understand the current auth testing strategy and identify what needed to be implemented.

## 2. Inspect repo state and auth cleanup context

- Read memory notes for prior auth cleanup context in `/memories/repo/api-test-cleanup.md`.
- Read the existing API cleanup helper in `services/api/test/setup/auth-state.cleanup.ts`.
- Searched for references to `cleanupApiAuthTestState` and `cleanupApiAuthRedisState` in the API workspace.
- Read `services/api/vitest.integration.config.mts` to confirm which integration tests were actually included.
- Read `services/api/test/test.setup.integration.ts` to see how cleanup was already wired.

## 3. Inspect auth fixtures and current test lanes

- Read `apps/mobile/tests/integration/auth-contract.integration.test.ts`.
- Read `apps/mobile/tests/integration/auth-flow.integration.test.ts`.
- Read `apps/mobile/tests/integration/harness.ts`.
- Read `apps/mobile/tests/integration/fixtures.ts`.
- Read `apps/mobile/tests/integration/assertions.ts`.
- Searched for auth test email patterns and route/test helpers across the workspace.
- Read `apps/web/tests/auth.flow-helpers.ts`.
- Read `apps/web/tests/auth.journeys.spec.ts`.
- Read `services/api/src/routes/test-helpers/auth.ts`.
- Read `tools/cli/src/utils/auth.test.ts`.
- Read `services/api/src/auth/test-otp-store.ts`.
- Read `services/api/src/routes/auth.test-otp-route.test.ts`.
- Read `services/api/src/routes/auth.ts` around the test OTP and auth route sections.
- Read `apps/web/tests/auth.spec.ts`.
- Read `apps/web/app/routes/auth/verify.tsx`.
- Read `apps/web/app/routes/auth/index.tsx`.
- Read `apps/web/app/routes/home.tsx`.
- Read `apps/web/app/routes/account.tsx`.
- Read `apps/web/app/routes/settings.security.tsx`.
- Read `apps/web/app/lib/guards.ts`.
- Read `apps/web/app/lib/auth.server.ts`.
- Read `apps/web/app/routes.ts`.
- Read `packages/ui/src/components/auth/otp-verification-form.tsx`.
- Read `packages/ui/src/components/auth/otp-code-input.tsx`.
- Read `packages/auth/src/auth-ux-contract.ts`.
- Read `apps/web/playwright.config.ts`.

## 4. Update the auth testing plan document

- Rewrote `docs/auth-test-journeys.md` to add:
  - test taxonomy
  - evidence standards
  - cleanup and isolation requirements
  - delivery order
  - updated surface ownership based on the current repo state
- Validated the edited plan file with `get_errors`.

## 5. Add the API auth cleanup helper and cleanup route

- Created `services/api/src/auth/test-cleanup.ts`.
- Updated `services/api/test/setup/auth-state.cleanup.ts` to re-export the shared cleanup helper.
- Updated `services/api/src/routes/auth.ts` to add `POST /api/auth/test/cleanup` behind the same test-only secret gate used by `/api/auth/test/otp/latest`.
- Added cleanup-route coverage to `services/api/src/routes/auth.test-otp-route.test.ts`.
- Validated the edited API files with `get_errors`.

## 6. Update the Web auth helpers and journeys

- Updated `apps/web/tests/auth.flow-helpers.ts` to:
  - add `resetAuthTestState()`
  - call the new API cleanup endpoint
  - add `requestEmailOtp()` as a reusable helper
- Updated `apps/web/tests/auth.journeys.spec.ts` to call `resetAuthTestState()` in `beforeEach` and to align the journey names with the real flow.
- Updated `apps/web/tests/_playwright-smoke.mjs` so local browser smoke checks also reset state through the cleanup endpoint.
- Validated the edited Web helper and journey files with `get_errors`.

## 7. Verify the API and Web typecheck state

- Ran `cd /Users/charlesponti/Developer/hominem/services/api && bunx vitest run --config vitest.contract.config.mts src/routes/auth.test-otp-route.test.ts`.
- Ran `cd /Users/charlesponti/Developer/hominem/apps/web && bun run typecheck`.

## 8. Track the cleanup fact in repo memory

- Added a repo-memory note about the new `POST /api/auth/test/cleanup` route and its purpose.
- Added a repo-memory note about the Web auth bootstrap and redirect behavior.

## 9. Start diagnosing the local stack for browser verification

Exact commands used:

```bash
lsof -nP -iTCP:4040 -sTCP:LISTEN || true
lsof -nP -iTCP:4445 -sTCP:LISTEN || true
lsof -nP -iTCP:4433 -sTCP:LISTEN || true
```

```bash
curl -sS -o /tmp/hominem_api_status.txt -w '%{http_code}' http://localhost:4040/api/status && printf '\n' && cat /tmp/hominem_api_status.txt
```

```bash
cd /Users/charlesponti/Developer/hominem && bun dev --filter @hominem/web
```

```bash
curl -sS -o /tmp/hominem_web_home.txt -w '%{http_code}' http://localhost:4445/home && printf '\n' && head -n 20 /tmp/hominem_web_home.txt
```

```bash
curl -sS -o /tmp/hominem_web_root.txt -w '%{http_code}' http://localhost:4445/ && printf '\n' && cat /tmp/hominem_web_root.txt | head -n 20
```

- Confirmed the API was already live and healthy.
- Confirmed the Web dev server was already occupied on port 4445.
- Confirmed `/home` and `/` behavior needed further investigation.

## 10. Run browser and Playwright verification attempts

Exact commands used:

```bash
cd /Users/charlesponti/Developer/hominem/apps/web && REUSE_SERVERS=true bunx playwright test tests/auth.journeys.spec.ts --config playwright.config.ts
```

```bash
bunx playwright test /Users/charlesponti/Developer/hominem/apps/web/tests/auth.journeys.spec.ts --config /Users/charlesponti/Developer/hominem/apps/web/playwright.config.ts
```

```bash
pushd /Users/charlesponti/Developer/hominem/apps/web >/dev/null && REUSE_SERVERS=true bunx playwright test tests/auth.journeys.spec.ts --config playwright.config.ts
```

```bash
pushd /Users/charlesponti/Developer/hominem/apps/web >/dev/null && REUSE_SERVERS=true bunx playwright test tests/auth.journeys.spec.ts --config playwright.config.ts
```

```bash
pushd /Users/charlesponti/Developer/hominem/apps/web >/dev/null && REUSE_SERVERS=true bunx playwright test tests/auth.journeys.spec.ts --config playwright.config.ts
```

- The Playwright config initially failed to reuse the existing Web server because the readiness probes were pointing at unhealthy URLs.
- Updated the Playwright config to probe `http://localhost:4040/api/status` and `http://localhost:4445/home` instead of the old root URLs.
- Reran the focused Web auth journey suite after the config fix.

## 11. Browser actions used to inspect the live Web app

Browser page used:

- `7e75193d-c472-415c-bec0-c4b3d0af5272` at `http://localhost:4445/home`

Exact browser actions:

- Opened the live Hakumi app at `/auth`.
- Typed `probe-browser@hominem.test` into the Email address field.
- Clicked `Continue` to move to the OTP verification screen.
- Inspected the verify page with `read_page` and confirmed the presence of six digit inputs and the hidden OTP field.
- Used `run_playwright_code` to fetch the latest OTP from `http://localhost:4040/api/auth/test/otp/latest`.
- Used `run_playwright_code` to submit the OTP through the real hidden form field and call `form.requestSubmit()`.
- Confirmed the browser navigated to `/home` after successful OTP verification.
- Inspected the authenticated `/home` page and confirmed the rendered shell and passkey banner.

## 12. Fix the Web route and auth helper mismatches uncovered by browser verification

Exact findings from browser and server inspection:

- `/home` was not behaving as a real protected authenticated destination.
- The app’s protected route redirect behavior was split between `/auth` and `/?next=`.
- `apps/web/app/lib/auth.server.ts` did not expose the `getServerSession` alias expected by existing loaders.
- `home.tsx` was using `getServerSession`, which caused a runtime failure until the alias was restored.
- `settings.security.tsx`, `account.tsx`, and `notes/layout.tsx` were aligned to use consistent auth redirect behavior.
- `apps/web/app/routes.ts` needed a distinct `/home` route alias to avoid duplicate route IDs.

Exact commands used to confirm the live behavior after fixes:

```bash
curl -sS -I http://localhost:4445/home
curl -sS -I http://localhost:4445/settings/security
```

## 13. Final verification steps that passed

- `pushd /Users/charlesponti/Developer/hominem/apps/web >/dev/null && REUSE_SERVERS=true bunx playwright test tests/auth.journeys.spec.ts --config playwright.config.ts`
- `pushd /Users/charlesponti/Developer/hominem/apps/web >/dev/null && REUSE_SERVERS=true bunx playwright test tests/auth.spec.ts tests/auth.journeys.spec.ts --config playwright.config.ts`
- `pushd /Users/charlesponti/Developer/hominem/apps/web >/dev/null && bun run typecheck`

## 14. Practical takeaways

- The Web OTP flow should be driven through the real hidden `otp` field, not by trying to type into masked digit inputs.
- Readiness probes for local Playwright reuse need stable, healthy URLs.
- `/home` needed to exist as an actual alias route for the Web auth journey suite to match the product’s real behavior.
- The browser verification loop is most useful when the tests, route config, and auth helpers are all aligned to the same contract.
