# Hakumi Mobile (iOS)

This app is the iOS client for Hakumi, built with Expo Router and Better Auth-backed API flows.

## Source Of Truth

This document intentionally does not duplicate runnable command strings.

Use the owning files directly when you need concrete entrypoints or automation details:

- `package.json`
- `app.config.ts`
- `eas.json`
- `.detoxrc.js`
- `tests/` and `e2e/`
- generated iOS project state under `ios/`

## Variant Model

The mobile app uses explicit runtime variants. `APP_VARIANT` controls app identity, native generation, and local env loading.

| Variant      | Purpose                           | Native Shape                    | OTA Updates        | Primary Ownership                                       |
| ------------ | --------------------------------- | ------------------------------- | ------------------ | ------------------------------------------------------- |
| `dev`        | local feature development         | Expo dev client plus Metro      | disabled           | mobile package manifest and app config                  |
| `e2e`        | deterministic mobile test runtime | standalone native test app      | disabled           | mobile package manifest, Detox config, and test harness |
| `preview`    | internal QA and release candidate | standalone update-enabled build | preview channel    | app config and EAS config                               |
| `production` | App Store and TestFlight          | standalone update-enabled build | production channel | app config and EAS config                               |

## Native Generation Rules

- `APP_VARIANT` is the single source of truth for app identity, bundle identifier, URL scheme, dev-client inclusion, and Expo updates behavior.
- The main app's shared app-group entitlement derives from the active bundle identifier.
- Only `dev` includes `expo-dev-client` and connects to Metro.
- `e2e`, `preview`, and `production` exclude the dev client and generate standalone native projects.
- Only `dev` and `e2e` may source local `.env.*.local` files. `preview` and `production` must use EAS-managed environments.
- Variant-specific prebuild behavior lives in the mobile package manifest and scripts directory.
- Do not hand-edit generated `ios/Podfile`, `Expo.plist`, or project naming to switch variants. Regenerate from the owning package surface instead.

If you move between simulator-focused and device-focused native shapes, regenerate the iOS project for the active variant before building or installing locally.

## Runtime Scope

- Production target: iOS only
- Authentication: email plus OTP via Better Auth API
- API: `@hominem/rpc` via authenticated HTTP requests

## Environment Model

### Development

- Local file: `.env.development.local`
- Variant: `APP_VARIANT=dev`
- Expected variables include:
  - `EXPO_PUBLIC_API_BASE_URL`
  - `EXPO_PUBLIC_E2E_TESTING`
  - `EXPO_PUBLIC_E2E_AUTH_SECRET`
  - `EXPO_APPLE_TEAM_ID`
  - `EXPO_PUBLIC_PASSKEY_RP_DOMAIN`
  - `EXPO_PUBLIC_MOBILE_PASSKEY_ENABLED`

### E2E

- Local file: `.env.e2e.local`
- Variant: `APP_VARIANT=e2e`
- Expected variables include:
  - `EXPO_PUBLIC_API_BASE_URL`
  - `EXPO_PUBLIC_E2E_TESTING`
  - `EXPO_PUBLIC_E2E_AUTH_SECRET`

### Preview

- Variant: `APP_VARIANT=preview`
- Environment ownership: EAS-managed `preview` environment
- Source of truth: `eas.json`, `app.config.ts`, and the EAS project environment

### Production

- Variant: `APP_VARIANT=production`
- Environment ownership: EAS-managed `production` environment
- Source of truth: `eas.json`, `app.config.ts`, and the EAS project environment

## Local Development Notes

- Device-focused local generation requires `EXPO_APPLE_TEAM_ID`.
- The simulator-oriented `e2e` workflow does not require a development team.
- `EXPO_PUBLIC_MOBILE_PASSKEY_ENABLED` should remain off unless the passkey surface is being intentionally validated.
- Expo maps `ios.appleTeamId` from app config into the generated Xcode project, which keeps device signing reproducible after regeneration.

## Verification Surfaces

- Auth-focused unit and integration coverage live under `tests/`.
- Route-level auth navigation and deep-link hydration are verified through the Expo Router testing harness.
- Native-critical coverage lives in Detox under `e2e/` and `.detoxrc.js`.
- Personal-device validation remains the final hardware-specific auth check.

The mobile package manifest and test config files are the source of truth for the current executable verification surface.

## Detox Auth Model

- Mobile auth is email plus OTP across development and E2E.
- E2E tests request OTP via `/api/auth/email-otp/send` and fetch deterministic OTP via `/api/auth/test/otp/latest`.
- OTP lookup requires `x-e2e-auth-secret` matching `AUTH_E2E_SECRET` on API.
- Test OTP retrieval remains disabled in production.
- Detox selectors are `testID`-driven and centered on auth and account screen flows.

## Release Surface

- Preview and production builds are controlled by the app config, EAS config, and EAS-managed environments.
- Apple account, Expo account, and credential ownership should remain outside markdown runbooks and inside the owning EAS/App Store setup.
- Treat the package manifest and release configuration files as the canonical source for the current release entrypoints.

## Device Auth Smoke Checklist

1. Generate and install the appropriate development build for the active variant on the test device.
2. Launch the app and complete email plus OTP sign-in.
3. Verify protected API-backed data loads without auth error.
4. Sign out and confirm the app returns to signed-out state.
5. Relaunch and confirm refresh-token session restore.
6. For passkey validation on a real device, use a backend configured with a stable HTTPS passkey domain rather than a local IP or `localhost`.

## Auth Readiness

- Read the closeout matrix in [tests/AUTH_READINESS.md](tests/AUTH_READINESS.md) before signing off auth changes.
- Detox is the repo-standard native-critical auth harness.
- The `dev` and `e2e` native projects are intentionally different and should be regenerated when switching harnesses.
- A final personal-device smoke pass is required before sign-off.

## Architecture

### Auth State Machine

The app uses a deterministic state machine for authentication state management in `utils/auth/types.ts` and `utils/auth-provider.tsx`.

The model is intentionally simple:

- booting
- authenticated
- unauthenticated
- error

This keeps auth transitions predictable, makes async cancellation easier to reason about, and reduces race conditions around startup and sign-in state.

### Error Boundaries

The app uses a three-tier error-handling model:

1. Root boundary at app level.
2. Feature boundaries around areas such as chat, focus, and auth.
3. Centralized error logging under `utils/error-boundary/`.
   - Contextual information for debugging

### State Consolidation

**Chat State:** Single source of truth with React Query

- Removed triple-state architecture (AI SDK + React Query + SQLite)
- React Query cache is the active state
- SQLite is persistence layer only
- Optimistic updates with automatic rollback

**Focus Items:** Server state with local fallback

- React Query for server state
- SQLite for offline persistence
- Automatic refetch when online

### Runtime Validation

Zod schemas for type-safe API responses (`utils/validation/schemas.ts`):

- `ChatMessageSchema` - Chat message validation
- `FocusItemSchema` - Focus item validation
- `UserProfileSchema` - User profile validation
- `NoteSchema` - Note validation

Replaces unsafe `as Type` assertions with runtime validation.

### Performance Optimizations

1. **FlashList Optimization** (`components/focus/focus-list.tsx`)
   - Memoized render items
   - Stable key extractor
   - `removeClippedSubviews` for memory efficiency

2. **Query Client Tuning** (`utils/query-client.ts`)
   - `staleTime: 60s` - Reduce unnecessary refetches
   - `gcTime: 10min` - Keep data in memory longer
   - Exponential backoff for retries
   - NetInfo integration for offline detection

3. **Effect Cleanup**
   - AbortController pattern for async operations
   - Proper timer/timeout cleanup
   - No memory leaks from abandoned promises

## iOS IDs

- Dev bundle ID: `com.pontistudios.hakumi.dev`
- E2E bundle ID: `com.pontistudios.hakumi.e2e`
- Preview bundle ID: `com.pontistudios.hakumi.preview`
- Prod bundle ID: `com.pontistudios.hakumi`
- Schemes:
  - `hakumi-dev`
  - `hakumi-e2e`
  - `hakumi-preview`
  - `hakumi`
