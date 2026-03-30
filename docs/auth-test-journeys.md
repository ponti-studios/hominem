# Auth Testing Runbook

This is the single source of truth for how auth should be tested in this repo.

It merges three things that were previously split across multiple docs:

- the auth testing strategy
- the exact commands that worked locally
- the integrated-browser procedure for manual verification

Future LLMs should treat this document as the authoritative execution guide for auth testing and auth verification work. Do not reconstruct the workflow from memory. Follow the steps here.

## Primary Goal

The goal is not to increase test count. The goal is to make every auth lane prove a real user journey or a real protocol boundary, with explicit ownership, explicit evidence, deterministic setup, and explicit cleanup.

## Non-Negotiable Rules

- A journey test must cross a real auth boundary: browser to network, provider to session store, device flow to stored token, or logout to revoked session.
- A contract test must prove a protocol guarantee at the API or adapter boundary.
- If a test only proves a local transformation or a mock call, it is not a journey test.
- API auth contract tests are the protocol source of truth.
- App-level journey tests should consume API contracts, not restate every protocol detail.
- Shared packages stay at adapter, serializer, reducer, redirect-safety, and contract level.
- Real user journeys belong to shipped surfaces: Web, Mobile, Desktop, and CLI.
- No auth test may depend on execution order or on another test leaving behind a valid session.
- Deterministic cleanup is part of the test, not an optional extra.

## Test Taxonomy

Use these categories consistently.

- Journey test: proves an end-user auth path across at least one real boundary and asserts a durable outcome.
- Contract test: proves a protocol or policy boundary such as cookie shape, bearer validation, OTP semantics, or step-up enforcement.
- Adapter test: proves hydration, persistence, serialization, redirect safety, or provider wiring without claiming a full user journey.
- Helper test: proves a pure local transformation or tiny rendering behavior. Keep these small or delete them.

If a file owns journeys, the primary test names should read like user outcomes, not helper function names.

## Evidence Standard

Every auth journey should assert all applicable proof points.

- Entry state: the test starts from a clearly named signed-out, booting, signed-in, or degraded state.
- Boundary crossing: the journey actually crosses the relevant auth boundary instead of simulating the final result only.
- Durable auth proof: the test proves session continuity, stored token reuse, redirect to protected shell, or authenticated session probe success.
- Fail-closed proof: invalid, expired, replayed, or partial auth data does not leave behind a usable session.
- Reset proof: logout, retry, or recovery returns the system to a predictable next state.

Surface-specific durable proof must be explicit.

- API: cookie mutation, bearer token acceptance or rejection, and `/api/auth/session` truth.
- Web: URL redirect, authenticated shell visibility, cookie-backed reload behavior, and logout re-protection.
- Mobile and Desktop: auth state convergence plus route-gate behavior plus persisted-session consequences.
- CLI: stored credential reuse by a later auth-dependent command, not just a single successful exchange.

## Deterministic Setup And Isolation

Persistent auth state is part of the system under test. Journey tests are not reliable unless cleanup is explicit.

- Use deterministic test identities with explicit prefixes for OTP, device-code, browser, and session-storage flows.
- Cleanup must cover users, verification rows, device codes, local cookies or session artifacts, and Redis-backed session, revocation, or rate-limit state where applicable.
- Do not depend on shared long-lived test accounts unless the test is explicitly read-only.
- Test-only OTP retrieval routes must remain explicitly authorized and fail closed when the secret is missing or wrong.
- Browser and device auth fixtures should encode the flow they belong to so failures are attributable without log archaeology.

## Canonical Files And Responsibilities

### API

The API owns auth protocol truth.

Current source-of-truth files:

- `services/api/src/routes/auth.email-otp.contract.test.ts`
- `services/api/src/routes/auth.device-contract.test.ts`
- `services/api/src/routes/auth.step-up.test.ts`
- `services/api/src/middleware/auth.test.ts`

P0 behaviors that must remain covered:

- Email OTP browser sign-in: send code, verify code, receive authenticated session, probe `/api/auth/session`, logout, confirm `401` after logout.
- Invalid OTP fail-closed: bad code does not create any authenticated session.
- Expired OTP fail-closed: expired code does not create any authenticated session.
- Replay fail-closed: the same OTP cannot establish a second session.
- Device flow happy path: issue device code, approve from authenticated browser session, exchange device token, probe `/api/auth/session` with bearer token.
- Step-up enforcement: first passkey registration may bypass step-up, existing passkey registration and deletion may not.

Definition of done for API P0:

- The API remains the single source of truth for OTP, device-code, session, and step-up behavior.
- Every fail-closed path proves absence of usable auth state, not just an error payload.

### Web

The web app owns real browser cookie, redirect, and auth-gate behavior.

Current source-of-truth files:

- `apps/web/tests/auth.journeys.spec.ts`
- `apps/web/tests/auth.spec.ts`
- `apps/web/tests/auth.flow-helpers.ts`
- `apps/web/playwright.config.ts`

P0 behaviors that must remain covered:

- Protected-route redirect journey: signed-out user opens a protected route, lands on `/auth`, completes OTP, and returns to the originally intended destination.
- Existing-session redirect journey: signed-in user opens `/auth` and is redirected away from the auth surface.
- Invalid-then-valid OTP recovery journey: user enters a bad OTP, remains on verify screen, retries with the right OTP, and reaches the product shell.
- Logout journey: signed-in user logs out, loses the authenticated shell, and a fresh protected navigation requires auth again.

Definition of done for Web P0:

- A signed-out protected navigation, a signed-in `/auth` visit, an OTP retry flow, and a logout re-protection flow all pass in Playwright against the real stack.

### Mobile

Mobile needs two auth layers:

- deterministic integration tests for provider, redirect, and state convergence
- true app-journey tests for native launch, relaunch, and deep-link behavior

Current useful lanes:

- `apps/mobile/tests/auth-provider.test.tsx`
- `apps/mobile/tests/integration/auth-contract.integration.test.ts`
- `apps/mobile/tests/integration/auth-flow.integration.test.ts`
- `apps/mobile/tests/integration/auth-journeys.integration.test.ts`
- `apps/mobile/tests/auth-state-machine.test.ts`
- `apps/mobile/tests/auth-route-guard.test.ts`

### Desktop

Desktop owns renderer bootstrap, OTP entry, passkey entry, and authenticated shell transitions.

Current useful lane:

- `apps/desktop/src/renderer/src/auth/session-client.test.ts`

### CLI

CLI owns device-code login, stored token reuse, issuer validation, and session validation against the API.

Current useful lane:

- `tools/cli/src/utils/auth.test.ts`

### Shared Package Boundary

`packages/auth` is not a user surface.

That package should keep:

- adapter tests for provider hydration and logout behavior
- mock-provider persistence tests
- redirect safety tests
- copy and error contract tests

It should not try to own browser, native, desktop, or CLI auth journeys.

## Required Workflow For Future LLMs

If the task is to validate or debug auth, use this order unless there is a strong reason not to.

1. Read this file before touching auth tests.
2. Inspect the current auth helpers and test lanes.
3. Confirm local stack health.
4. Run the focused API or Web tests from the correct workspace directory.
5. If Web auth behavior is in question, run the integrated-browser flow.
6. Only after those pass should you widen scope to broader suites or unrelated auth cleanup.

Do not start by guessing which route, helper, or hidden field is authoritative. The workflow below already resolved that ambiguity.

## Exact Repo Inspection Steps

These reads were useful and remain the right starting point when auth behavior is unclear.

- `apps/web/tests/auth.flow-helpers.ts`
- `apps/web/tests/auth.journeys.spec.ts`
- `apps/web/tests/auth.spec.ts`
- `apps/web/app/routes/auth/index.tsx`
- `apps/web/app/routes/auth/verify.tsx`
- `apps/web/app/routes/home.tsx`
- `apps/web/app/routes/account.tsx`
- `apps/web/app/routes/settings.security.tsx`
- `apps/web/app/lib/guards.ts`
- `apps/web/app/lib/auth.server.ts`
- `apps/web/app/routes.ts`
- `apps/web/playwright.config.ts`
- `packages/ui/src/components/auth/otp-verification-form.tsx`
- `packages/ui/src/components/auth/otp-code-input.tsx`
- `packages/auth/src/auth-ux-contract.ts`
- `services/api/src/routes/auth.ts`
- `services/api/src/routes/auth.test-otp-route.test.ts`
- `services/api/src/routes/test-helpers/auth.ts`
- `services/api/src/auth/test-otp-store.ts`
- `tools/cli/src/utils/auth.test.ts`

## Exact Local Stack Commands

Run these commands in this order when checking local auth test readiness.

### 1. Confirm which services are already live

```bash
lsof -nP -iTCP:4040 -sTCP:LISTEN || true
lsof -nP -iTCP:4445 -sTCP:LISTEN || true
lsof -nP -iTCP:4433 -sTCP:LISTEN || true
```

### 2. Confirm the API is healthy

```bash
curl -sS -o /tmp/hominem_api_status.txt -w '%{http_code}' http://localhost:4040/api/status && printf '\n' && cat /tmp/hominem_api_status.txt
```

### 3. Start the Web app only if it is not already running

```bash
cd /Users/charlesponti/Developer/hominem && bun dev --filter @hominem/web
```

### 4. Confirm the Web surface is reachable on the real auth-relevant routes

```bash
curl -sS -o /tmp/hominem_web_home.txt -w '%{http_code}' http://localhost:4445/home && printf '\n' && head -n 20 /tmp/hominem_web_home.txt
```

```bash
curl -sS -o /tmp/hominem_web_root.txt -w '%{http_code}' http://localhost:4445/ && printf '\n' && cat /tmp/hominem_web_root.txt | head -n 20
```

The practical lesson here is important:

- do not treat `/` as the canonical readiness signal for auth work
- the useful readiness checks were `http://localhost:4040/api/status` and `http://localhost:4445/home`

## Exact Test Commands That Worked

Always run Web auth Playwright from the Web workspace directory or with paths scoped to the Web config.

### Focused Web journey suite

```bash
cd /Users/charlesponti/Developer/hominem/apps/web && REUSE_SERVERS=true bunx playwright test tests/auth.journeys.spec.ts --config playwright.config.ts
```

Equivalent working form:

```bash
pushd /Users/charlesponti/Developer/hominem/apps/web >/dev/null && REUSE_SERVERS=true bunx playwright test tests/auth.journeys.spec.ts --config playwright.config.ts
```

### Combined Web smoke plus journeys

```bash
pushd /Users/charlesponti/Developer/hominem/apps/web >/dev/null && REUSE_SERVERS=true bunx playwright test tests/auth.spec.ts tests/auth.journeys.spec.ts --config playwright.config.ts
```

### Web typecheck

```bash
pushd /Users/charlesponti/Developer/hominem/apps/web >/dev/null && bun run typecheck
```

### Focused API contract validation used during auth cleanup

```bash
cd /Users/charlesponti/Developer/hominem/services/api && bunx vitest run --config vitest.contract.config.mts src/routes/auth.test-otp-route.test.ts
```

## Playwright Readiness Requirement

The focused Web suite originally failed for infrastructure reasons because the config tried to reuse servers through unhealthy URLs.

Future LLMs should remember this exact fix:

- Playwright server reuse should probe `http://localhost:4040/api/status`
- Playwright server reuse should probe `http://localhost:4445/home`
- do not switch those probes back to the old root-path checks without a deliberate reason

## Integrated Browser Runbook

Use the integrated browser when the user explicitly asks for a real browser flow, or when Playwright passes but the user wants visual confirmation.

### Browser page target

The live page used successfully during auth verification was:

- `/auth` for email entry
- `/auth/verify` for OTP verification
- `/home` or `/account` for authenticated shell confirmation

### Exact integrated-browser procedure

1. Open the live Hakumi app at `/auth`.
2. Type a deterministic test email such as `probe-browser@hominem.test` into the Email address field.
3. Click `Continue`.
4. Inspect the verify page and confirm the OTP screen is present.
5. Fetch the latest OTP from the test-only API route.
6. Submit the OTP through the real form contract.
7. Confirm the browser lands on the protected shell.
8. Confirm logout re-protects the app when relevant.

### Critical OTP rule

This is the most important Web auth testing lesson from the prior sessions:

- `otp` should be driven through the real hidden `otp` field or the current real OTP form contract
- do not try to validate the journey by typing into obsolete masked digit inputs if those are no longer the actual submission boundary

Earlier sessions proved that driving the wrong visual control can make a healthy auth flow look broken.

### Exact browser actions previously used successfully

- Opened the live Hakumi app at `/auth`.
- Typed `probe-browser@hominem.test` into the Email address field.
- Clicked `Continue` to move to the OTP verification screen.
- Inspected the verify page and confirmed the OTP UI plus the hidden OTP form contract.
- Used browser automation to fetch the latest OTP from `http://localhost:4040/api/auth/test/otp/latest`.
- Submitted the OTP through the real form field and called `form.requestSubmit()`.
- Confirmed navigation to `/home` after successful verification.
- Inspected the authenticated shell and confirmed the rendered protected app state.

## Required Test Infrastructure Facts

These facts are now part of the expected auth test environment.

- The API exposes `POST /api/auth/test/cleanup` for deterministic auth-state reset under the same test-only authorization model as the OTP fetch route.
- Web auth helpers should call that cleanup endpoint before each browser journey when the test expects a clean signed-out start.
- The Web auth flow helpers own plumbing such as requesting OTP, resetting auth state, and fetching test OTP values.
- Assertions belong in the journey spec, not in the helpers.

## Route And Runtime Facts Future LLMs Must Not Forget

- `/home` must exist as a real authenticated alias route.
- The Web auth journey suite must match the shipped route behavior, not a guessed route shape.
- Web SSR auth bootstrap should resolve first-party auth from Better Auth session cookies.
- The CLI/device flow now uses Better Auth’s standard `access_token` response body instead of a custom compatibility header.

## Tools That Were Actually Useful

These are the tools that mattered while diagnosing and validating auth. Future LLMs should prefer them for the same jobs.

- `read_file` for route, helper, test, and component inspection
- `grep_search` for locating auth symbols and OTP helpers quickly
- `get_errors` after edits
- `get_changed_files` before staging or when the repo is dirty
- `memory` for prior repo-scoped auth cleanup facts
- `apply_patch` for code and doc edits
- `run_in_terminal` for `curl`, `lsof`, Vitest, Playwright, and typecheck commands
- `open_browser_page`, `read_page`, `click_element`, `type_in_page`, and `run_playwright_code` for integrated-browser validation

## Surface Ownership Summary

### API ownership

- keeps protocol truth for OTP, device code, bearer acceptance, cookie session truth, and step-up rules

### Web ownership

- keeps real browser redirect, cookie, auth-gate, reload, and logout behavior

### Mobile ownership

- keeps deterministic provider and state-convergence journeys plus eventual native lifecycle coverage

### Desktop ownership

- keeps renderer bootstrap, OTP, passkey, and logout shell transitions

### CLI ownership

- keeps device-code acquisition, stored-token reuse, issuer validation, and invalidation behavior

## Delivery Order

When auth work spans multiple surfaces, execute in this order.

1. Stabilize auth test infrastructure.
2. Keep Mobile deterministic P0 journeys stable.
3. Consolidate Web P0 browser journeys on the real stack.
4. Sharpen CLI P0 journeys around acquisition, reuse, and invalidation.
5. Add Desktop P0 renderer journeys.
6. Delete or demote helper-only auth tests that became redundant.
7. Add P1 journeys only after P0 lanes are stable in CI.

## Rewrite Rule For New Auth Tests

Before adding any new auth test, ask three questions.

1. If this broke in production, would this test catch it?
2. What durable proof of auth state does the test assert?
3. Which surface owns this behavior?

If you cannot answer all three, the test belongs in a smaller adapter or helper lane, or it should not exist at all.
