## ADDED Requirements

### Requirement: Auth provider SHALL be a composition root

The `AuthProvider` component in `lib/auth/auth-provider.tsx` SHALL only compose hooks and provide React context. It SHALL NOT contain boot logic, OTP logic, or direct API calls.

#### Scenario: AuthProvider composes hooks

- **WHEN** examining `AuthProvider` implementation
- **THEN** it calls `useBootSequence()`, `useEmailOtp()`, `usePasskeyAuth()`, and `useSignOut()`
- **AND** it does not contain `useCallback` definitions for `requestEmailOtp`, `verifyEmailOtp`, or `signOut`

#### Scenario: AuthProvider provides context without side effects

- **WHEN** `AuthProvider` renders
- **THEN** it returns `<AuthContext.Provider value={...}>{children}</AuthContext.Provider>`
- **AND** side effects (boot sequence, analytics) are triggered via hooks inside the provider

### Requirement: Boot sequence SHALL be extracted to `useBootSequence` hook

The `lib/auth/hooks/use-boot-sequence.ts` hook SHALL encapsulate all boot-time logic including:
- Legacy data migration (`clearLegacyLocalDataOnce`)
- Session probing (`runAuthBoot`)
- Timeout management (8 second `AUTH_BOOT_TIMEOUT_MS`)
- State dispatch to auth machine

#### Scenario: Boot sequence runs once on mount

- **WHEN** `useBootSequence` is called
- **THEN** it runs the boot sequence exactly once (guarded by `hasBootstrappedRef`)
- **AND** it dispatches `SESSION_LOADED` or `SESSION_EXPIRED` to the auth machine

#### Scenario: Boot sequence handles timeout

- **WHEN** the session probe exceeds 8 seconds
- **THEN** the controller is aborted
- **AND** `SESSION_RECOVERY_FAILED` is dispatched with a timeout error

### Requirement: Email OTP flow SHALL be extracted to `useEmailOtp` hook

The `lib/auth/hooks/use-email-otp.ts` hook SHALL encapsulate:
- `requestEmailOtp(email)` with 12 second timeout
- `verifyEmailOtp({ email, otp, name })` with 20 second timeout
- State dispatch for all OTP phases

#### Scenario: OTP request dispatches correct states

- **WHEN** `requestEmailOtp` is called
- **THEN** `OTP_REQUEST_STARTED` → `OTP_REQUESTED` or `OTP_REQUEST_FAILED` is dispatched

#### Scenario: OTP verification dispatches correct states

- **WHEN** `verifyEmailOtp` is called
- **THEN** `OTP_VERIFICATION_STARTED` → `PROFILE_SYNC_STARTED` → `SESSION_LOADED` on success
- **OR** `OTP_VERIFICATION_FAILED` on failure

### Requirement: Passkey auth SHALL be extracted to `usePasskeyAuth` hook

The `lib/auth/hooks/use-passkey-auth.ts` hook SHALL encapsulate:
- `completePasskeySignIn(input)` — completes passkey flow after native auth succeeds
- State dispatch for passkey phases

#### Scenario: Passkey sign-in dispatches correct states

- **WHEN** `completePasskeySignIn` is called with valid `SignInResponse`
- **THEN** `PASSKEY_AUTH_STARTED` → `PROFILE_SYNC_STARTED` → `SESSION_LOADED` on success
- **OR** `PASSKEY_AUTH_FAILED` on failure

### Requirement: Sign-out SHALL be extracted to `useSignOut` hook

The `lib/auth/hooks/use-sign-out.ts` hook SHALL encapsulate:
- `signOut()` — clears session, cookies, and local data
- State dispatch for sign-out phases

#### Scenario: Sign-out clears all session data

- **WHEN** `signOut` is called
- **THEN** Better Auth `signOut()` is called
- **AND** `clearPersistedSessionCookies()` is called
- **AND** `LocalStore.clearAllData()` is called
- **AND** `SIGN_OUT_REQUESTED` → `SIGN_OUT_SUCCESS` is dispatched

### Requirement: Auth analytics SHALL be unified

The `lib/auth/analytics.ts` file SHALL consolidate `auth-event-log.ts` and `auth-analytics.ts` functionality:
- `captureAuthAnalyticsEvent(event, properties)` — captures PostHog events
- `captureAuthAnalyticsFailure(event, properties)` — captures failure events with error details
- `recordAuthEvent(event, phase)` — logs to console in development

#### Scenario: Analytics captures all auth events

- **WHEN** any auth flow (boot, OTP, passkey, sign-out) completes
- **THEN** `captureAuthAnalyticsEvent` is called with the event name and phase
- **AND** `recordAuthEvent` logs the event in development

### Requirement: State machine SHALL be extracted to `lib/auth/machines/auth-machine.ts`

The auth state machine (`authStateMachine` reducer and `AuthState`/`AuthEvent` types) SHALL live in `lib/auth/machines/` separate from the provider.

#### Scenario: State machine reducer is pure

- **WHEN** `authStateMachine(currentState, event)` is called
- **THEN** it returns a new state object (immutable)
- **AND** it does not perform side effects (no API calls, no storage)

### Requirement: Auth client creation SHALL remain in auth-provider

The `authClient` instance (created from `better-auth/react` with expo and passkey plugins) SHALL be created in `lib/auth/auth-provider.tsx` and MAY be exported for use by hooks.

#### Scenario: Auth client is available to hooks

- **WHEN** `useEmailOtp` or `usePasskeyAuth` needs to call Better Auth
- **THEN** it uses the `authClient` instance provided via context or direct import
