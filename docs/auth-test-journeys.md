# Auth Journey Test Plan

This is the auth test sketch for all first-party surfaces.

The point is not to increase test count. The point is to make each auth lane prove a real user journey or a real protocol boundary.

## First Principles

- A journey test must cross a real auth boundary: UI to network, provider to session store, device flow to stored token, or logout to revoked session.
- If a test only proves that a local helper transformed a string or that a mock function was called, it is not a journey test.
- API auth contract tests are the protocol source of truth. App-level journey tests should consume those contracts, not re-assert every protocol detail.
- Shared package tests should stay at adapter and contract level. The user journeys belong to the actual app surfaces.

## Surface Ownership

### API

The API owns auth protocol truth.

Current useful lane:

- `services/api/src/routes/auth.email-otp.contract.test.ts`
- `services/api/src/routes/auth.device-contract.test.ts`
- `services/api/src/routes/auth.step-up.test.ts`
- `services/api/src/middleware/auth.test.ts`

P0 journeys to keep or sharpen:

- Email OTP browser sign-in: send code, verify code, receive authenticated session, probe `/api/auth/session`, logout, confirm `401` after logout.
- Invalid OTP fail-closed: bad code does not create any authenticated session.
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
- Keep step-up journeys in `auth.step-up.test.ts` because that file already owns the passkey policy boundary.
- Do not move contract tests into the integration config unless the config intent changes deliberately.

### Web

The web app owns real browser cookie, redirect, and auth-gate behavior.

Current useful lane:

- `apps/web/tests/auth.spec.ts`
- `apps/web/tests/auth.flow-helpers.ts`

P0 journeys to add or consolidate:

- Protected-route redirect journey: signed-out user opens a protected route, lands on `/auth`, completes OTP, returns to the originally intended destination.
- Existing-session redirect journey: signed-in user opens `/auth` and is redirected away from the auth surface.
- Invalid-then-valid OTP recovery journey: user enters a bad OTP, remains on verify screen, retries with the right OTP, and reaches the product shell.
- Logout journey: signed-in user logs out, loses the authenticated shell, and a fresh protected navigation requires auth again.

P1 journeys to add:

- Passkey fallback journey: passkey prompt is unavailable, cancelled, or fails, and the user can continue via email OTP without getting stuck.
- Session restore journey: browser reload with a valid cookie lands directly in the authenticated shell.
- Security settings journey: authenticated user reaches passkey-management UI and sees enrollment controls.

Recommended file shape:

- Promote `apps/web/tests/auth.spec.ts` into a broader `auth.journeys.spec.ts` lane once it starts covering redirect, retry, and logout.
- Keep `auth.flow-helpers.ts` as plumbing only. Assertions belong in the journey spec, not the helper.

### Mobile

Mobile needs two auth layers:

- deterministic integration tests for provider, redirect, and state convergence
- true app-journey tests for native launch, relaunch, and deep-link behavior

Current useful lane:

- `apps/mobile/tests/auth-provider.test.tsx`
- `apps/mobile/tests/integration/auth-contract.integration.test.ts`
- `apps/mobile/tests/integration/auth-flow.integration.test.ts`
- `apps/mobile/tests/auth-state-machine.test.ts`
- `apps/mobile/tests/auth-route-guard.test.ts`

P0 deterministic journeys to own in Vitest:

- Boot restore journey: stored session cookie probes successfully, user lands in signed-in state, protected route does not redirect.
- Boot expiry journey: invalid or expired session cookie clears local auth and lands in signed-out state.
- Email OTP journey: request OTP, verify OTP, persist Better Auth cookie, persist user profile, and expose auth headers for downstream requests.
- Logout journey: remote logout succeeds, local session cookies are cleared, local data is cleared, protected route redirects to auth.
- Passkey fail-closed journey: passkey response without a persisted cookie does not authenticate the app.

P1 native journeys to own in Detox or equivalent:

- Cold-launch OTP sign-in journey from app launch to authenticated shell.
- Relaunch with valid session journey: app restarts directly into the protected shell.
- Sign-out relaunch journey: after logout, app relaunch stays signed out.
- Deep-link protected journey: deep-link into a protected surface while signed out, then authenticate and continue.
- Passkey journey on supported targets: success and cancel behavior.

Tests to demote or fold into journeys:

- `apps/mobile/tests/screens/auth-screens.test.tsx` should shrink to the smallest amount of local rendering/input behavior that is not already covered by provider journeys.
- `apps/mobile/tests/routes/auth-router.test.tsx` should be folded into redirect or launch journeys instead of owning navigation in isolation.
- Pure helper-only tests that do not touch shipped code should be deleted rather than preserved.

Recommended file shape:

- Keep provider behavior in `tests/auth-provider.test.tsx`.
- Add a new `tests/integration/auth-journeys.integration.test.ts` once the provider and route flows start being asserted together.
- Keep device-level launch and relaunch auth in the mobile e2e lane, not in component tests.

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

## Shared Package Boundary

`packages/auth` is not a user surface.

That package should keep:

- adapter tests for provider hydration and logout behavior
- mock-provider persistence tests
- redirect safety tests
- copy and error contract tests

It should not try to own browser, native, desktop, or CLI auth journeys.

## Recommended File Map

- API: keep current contract and integration files, but rename test cases around journeys instead of helper scenarios.
- Web: grow `apps/web/tests/auth.spec.ts` into `apps/web/tests/auth.journeys.spec.ts`.
- Mobile: keep `apps/mobile/tests/auth-provider.test.tsx`, add `apps/mobile/tests/integration/auth-journeys.integration.test.ts`, and grow the native e2e auth lane around launch/relaunch/deep-link journeys.
- Desktop: add `apps/desktop/src/renderer/src/auth/auth-provider.journeys.test.tsx`.
- CLI: keep `tools/cli/src/utils/auth.test.ts`, but regroup it around device-login and stored-session journeys.

## Rewrite Rule

Before adding any new auth test, ask one question:

"If this broke in production, would this test catch it?"

If the answer is no, it belongs in a tiny helper test, or it should not exist at all.
