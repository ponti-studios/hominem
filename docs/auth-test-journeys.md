# Auth Journey Test Plan

This document defines the auth test strategy for all first-party surfaces.

The goal is not to increase test count. The goal is to make each auth lane prove a real user journey or a real protocol boundary, with explicit ownership and explicit evidence.

## First Principles

- A journey test must cross a real auth boundary: browser to network, provider to session store, device flow to stored token, or logout to revoked session.
- A contract test must prove a protocol guarantee at the API or adapter boundary.
- If a test only proves that a local helper transformed a value or that a mock function was called, it is not a journey test.
- API auth contract tests are the protocol source of truth. App-level journey tests should consume those contracts, not restate every protocol detail.
- Shared packages stay at adapter, reducer, serializer, and contract level. Real user journeys belong to the shipped surfaces.
- Every auth test should make the ownership boundary more obvious, not less.

## Test Taxonomy

Use these labels consistently.

- Journey test: proves an end-user auth path across at least one real boundary and asserts a durable outcome.
- Contract test: proves a protocol or policy boundary such as cookie shape, bearer validation, OTP semantics, or step-up enforcement.
- Adapter test: proves hydration, persistence, serialization, redirect safety, or provider wiring without claiming a full user journey.
- Helper test: proves a pure local transformation or tiny rendering behavior. Keep these small or delete them.

A test should not mix categories casually. If a file owns journeys, the primary test names should read like user outcomes, not helper function names.

## Evidence Standard

Every auth journey should assert all applicable proof points.

- Entry state: the test starts from a clearly named signed-out, booting, signed-in, or degraded state.
- Boundary crossing: the journey actually crosses the relevant auth boundary instead of simulating the final result only.
- Durable auth proof: the test proves session continuity, stored token reuse, redirect to protected shell, or authenticated session probe success.
- Fail-closed proof: invalid, expired, replayed, or partial auth data does not leave behind a usable session.
- Reset proof: logout, retry, or recovery returns the system to a predictable next state.

Surface-specific durable proof should be explicit.

- API: cookie mutation, bearer token acceptance or rejection, and `/api/auth/session` truth.
- Web: URL redirect, authenticated shell visibility, cookie-backed reload behavior, and logout re-protection.
- Mobile and Desktop: auth state convergence plus route-gate behavior plus persisted-session consequences.
- CLI: stored credential reuse by a later auth-dependent command, not just a single successful exchange.

## State Isolation And Fixtures

Persistent auth state is part of the system under test. Journey tests are not reliable unless cleanup is part of the plan.

- Use deterministic test identities with explicit prefixes for OTP, device-code, browser, and session-storage flows.
- Cleanup must cover users, verification rows, device codes, local cookies or session artifacts, and Redis-backed session, revocation, or rate-limit state where applicable.
- Do not depend on shared long-lived test accounts unless the test is explicitly read-only.
- No journey may depend on execution order or on another journey leaving behind a valid session.
- Test-only OTP retrieval routes must remain explicitly authorized and fail closed when the secret is missing or wrong.
- Browser and device auth fixtures should encode the flow they belong to so failures are attributable without log archaeology.

## Surface Ownership

### API

The API owns auth protocol truth.

Current useful lanes:

- `services/api/src/routes/auth.email-otp.contract.test.ts`
- `services/api/src/routes/auth.device-contract.test.ts`
- `services/api/src/routes/auth.step-up.test.ts`
- `services/api/src/middleware/auth.test.ts`

P0 journeys to keep or sharpen:

- Email OTP browser sign-in: send code, verify code, receive authenticated session, probe `/api/auth/session`, logout, confirm `401` after logout.
  Required proof: session creation mutates auth state, logout revokes it, and no stale auth survives the logout boundary.
- Invalid OTP fail-closed: bad code does not create any authenticated session.
  Required proof: no usable cookie, no authenticated session probe, no partial mutation that affects retry.
- Expired OTP fail-closed: expired code does not create any authenticated session.
- Replay fail-closed: the same OTP cannot establish a second session.
- Device flow happy path: issue device code, approve from authenticated browser session, exchange device token, probe `/api/auth/session` with bearer token.
- Step-up enforcement: first passkey registration may bypass step-up, existing passkey registration and deletion may not.

P1 journeys to add:

- Rate limiting path: repeated OTP sends degrade predictably without partial session creation.
- Token contract path: legacy token shapes and invalid bearer tokens fail closed without mutating cookies.
- Test OTP route authorization: internal OTP fetch route rejects missing or wrong auth secret.

Recommended file shape:

- Keep contract-style route journeys in the existing auth contract files.
- Keep step-up journeys in `auth.step-up.test.ts` because that file owns the passkey policy boundary.
- Do not move contract tests into the integration config unless the config intent changes deliberately.

Definition of done for API P0:

- The API remains the single source of truth for OTP, device-code, session, and step-up behavior.
- Every fail-closed path proves absence of usable auth state, not just an error payload.

### Web

The web app owns real browser cookie, redirect, and auth-gate behavior.

Current useful lanes:

- `apps/web/tests/auth.journeys.spec.ts`
- `apps/web/tests/auth.spec.ts`
- `apps/web/tests/auth.flow-helpers.ts`

P0 journeys to consolidate:

- Protected-route redirect journey: signed-out user opens a protected route, lands on `/auth`, completes OTP, and returns to the originally intended destination.
  Required proof: the redirect preserves intended destination safely and a post-auth navigation lands in the protected shell.
- Existing-session redirect journey: signed-in user opens `/auth` and is redirected away from the auth surface.
- Invalid-then-valid OTP recovery journey: user enters a bad OTP, remains on verify screen, retries with the right OTP, and reaches the product shell.
- Logout journey: signed-in user logs out, loses the authenticated shell, and a fresh protected navigation requires auth again.

P1 journeys to add:

- Passkey fallback journey: passkey prompt is unavailable, cancelled, or fails, and the user can continue via email OTP without getting stuck.
- Session restore journey: browser reload with a valid cookie lands directly in the authenticated shell.
- Security settings journey: authenticated user reaches passkey-management UI and sees enrollment controls.

Operational requirement:

- Browser auth journeys need a stable full-stack startup path, deterministic OTP retrieval, and deterministic state cleanup. Until that exists, Web journey tests will keep failing for infrastructure reasons instead of auth reasons.

Recommended file shape:

- Consolidate meaningful browser auth assertions in `auth.journeys.spec.ts`.
- Keep `auth.spec.ts` only as a thin smoke lane or fold it into `auth.journeys.spec.ts`.
- Keep `auth.flow-helpers.ts` as plumbing only. Assertions belong in the journey spec, not the helper.

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

P0 deterministic journeys to own in Vitest:

- Boot restore journey: stored session cookie probes successfully, user lands in signed-in state, protected route does not redirect.
- Boot expiry journey: invalid or expired session cookie clears local auth and lands in signed-out state.
- Email OTP journey: request OTP, verify OTP, persist Better Auth cookie, persist user profile, and expose auth headers for downstream requests.
- Logout journey: remote logout succeeds, local session cookies are cleared, local data is cleared, and the protected route redirects to auth.
- Passkey fail-closed journey: passkey response without a persisted cookie does not authenticate the app.

P1 native journeys to own in Detox or equivalent:

- Cold-launch OTP sign-in journey from app launch to authenticated shell.
- Relaunch with valid session journey: app restarts directly into the protected shell.
- Sign-out relaunch journey: after logout, app relaunch stays signed out.
- Deep-link protected journey: deep-link into a protected surface while signed out, then authenticate and continue.
- Passkey journey on supported targets: success and cancel behavior.

Tests to demote or fold into journeys:

- `apps/mobile/tests/screens/auth-screens.test.tsx` should shrink to the smallest amount of local rendering or input behavior not already covered by provider journeys.
- `apps/mobile/tests/routes/auth-router.test.tsx` should be folded into redirect or launch journeys instead of owning navigation in isolation.
- Pure helper-only tests that do not touch shipped code should be deleted rather than preserved.

Recommended file shape:

- Keep provider behavior in `tests/auth-provider.test.tsx`.
- Keep and grow `tests/integration/auth-journeys.integration.test.ts` as the deterministic auth-journey lane.
- Keep device-level launch and relaunch auth in the mobile e2e lane, not in component tests.

Definition of done for Mobile P0:

- The deterministic integration lane proves boot, OTP, logout, and fail-closed passkey behavior without depending on native harnesses.
- The remaining gap is explicitly only native lifecycle coverage.

### Desktop

Desktop owns renderer bootstrap, OTP entry, passkey entry, and authenticated shell transitions.

Current useful lane:

- `apps/desktop/src/renderer/src/auth/session-client.test.ts`

Current gap:

- Desktop has transport-level coverage, but almost no actual renderer journey coverage.

P0 journeys to add:

- Bootstrap journey: renderer starts signed out when no session exists.
- Existing-session bootstrap journey: renderer starts directly in the authenticated shell when a valid session exists.
- Email OTP journey: request OTP, verify OTP, move from auth gate to authenticated shell.
- Passkey journey: passkey sign-in succeeds and moves the renderer to the authenticated shell.
- Logout journey: signed-in renderer logs out and returns to the auth gate.

P1 journeys to add:

- Passkey cancellation journey: cancelled passkey attempt surfaces a retryable error and does not corrupt state.
- Session-refresh failure journey: bootstrap network failure produces a recoverable degraded state.
- Restart-auth journey: desktop reset path clears error and returns to signed-out flow.

Recommended file shape:

- Add `apps/desktop/src/renderer/src/auth/auth-provider.journeys.test.tsx` for renderer-level flows.
- Keep `session-client.test.ts` for serializer, fetch, and low-level error mapping only.

Definition of done for Desktop P0:

- Renderer bootstrap, OTP sign-in, passkey sign-in, and logout all prove shell transitions, not just transport responses.

### CLI

CLI owns device-code login, stored token reuse, issuer validation, and session validation against the API.

Current useful lane:

- `tools/cli/src/utils/auth.test.ts`

Current gap:

- The CLI suite covers transport edges well, but it does not yet read like a user journey from unauthenticated CLI to usable stored session.

P0 journeys to sharpen:

- Device-code happy path: request device code, exchange approved device code, store Better Auth bearer token, and prove a later auth-dependent command can reuse it.
- Issuer mismatch journey: stored token for one issuer fails fast when a command targets another issuer.
- Browser-open failure journey: interactive login fails loudly without persisting partial auth state.
- Pending-to-timeout journey: device authorization never completes and the CLI surfaces an explicit timeout.

P1 journeys to add:

- Expired device code journey: CLI surfaces a specific terminal failure instead of generic auth failure.
- Session-validation journey: stored token exists but `/api/auth/session` rejects it, so the CLI reports the session as invalid and forces re-auth.
- Logout journey: local credentials are cleared and later commands behave as unauthenticated.

Recommended file shape:

- Keep the existing file, but group tests by journey names instead of helper function names.
- Pair `deviceCodeLogin` with `hasValidStoredSession` in at least one end-to-end CLI auth journey.

Definition of done for CLI P0:

- The suite proves not only credential acquisition but also subsequent reuse and invalidation behavior.

## Shared Package Boundary

`packages/auth` is not a user surface.

That package should keep:

- adapter tests for provider hydration and logout behavior
- mock-provider persistence tests
- redirect safety tests
- copy and error contract tests

It should not try to own browser, native, desktop, or CLI auth journeys.

If a package test starts asserting full redirect flows, shell transitions, or device login behavior, it is probably stealing responsibility from a real surface.

## Delivery Order

Execute the plan in this order.

1. Stabilize auth test infrastructure.
   Requirements: deterministic fixture naming, deterministic OTP retrieval, explicit auth-state cleanup, reusable full-stack startup for browser journeys.
2. Finish and keep stable the Mobile deterministic P0 journey lane.
3. Consolidate Web P0 browser journeys on the real stack.
4. Sharpen CLI P0 journeys around acquisition, reuse, and invalidation.
5. Add Desktop P0 renderer journeys.
6. Delete or demote helper-only auth tests that became redundant.
7. Add P1 journeys only after P0 lanes are stable in CI.

## Recommended File Map

- API: keep current contract and integration files, but name test cases around journeys and fail-closed outcomes instead of helper scenarios.
- Web: consolidate around `apps/web/tests/auth.journeys.spec.ts`, keep `apps/web/tests/auth.spec.ts` only as smoke if it still earns its existence.
- Mobile: keep `apps/mobile/tests/auth-provider.test.tsx`, `apps/mobile/tests/integration/auth-contract.integration.test.ts`, `apps/mobile/tests/integration/auth-flow.integration.test.ts`, and grow `apps/mobile/tests/integration/auth-journeys.integration.test.ts`.
- Desktop: add `apps/desktop/src/renderer/src/auth/auth-provider.journeys.test.tsx`.
- CLI: keep `tools/cli/src/utils/auth.test.ts`, but regroup it around device-login and stored-session journeys.

## Rewrite Rule

Before adding any new auth test, ask three questions.

1. If this broke in production, would this test catch it?
2. What durable proof of auth state does the test assert?
3. Which surface owns this behavior?

If you cannot answer all three, the test belongs in a smaller adapter or helper lane, or it should not exist at all.
