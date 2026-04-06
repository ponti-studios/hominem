# Hominem Apple

Native SwiftUI client for iOS and macOS.

## Structure

- `Package.swift` contains the shared Swift package used by both app targets.
- `project.yml` defines the Xcode project and both app targets.
- `iOS/` and `macOS/` contain thin host apps.
- `Sources/HominemAppleCore` contains the shared auth, networking, passkey, and UI code.
- `Tests/HominemAppleCoreTests` contains the Swift package tests.

## Local defaults

- API base URL defaults to `http://localhost:4040`
- Override with `HOMINEM_API_BASE_URL`
- To enable local OTP autofill for macOS/iOS debug builds, also set `HOMINEM_AUTH_TEST_SECRET`

## Build configurations

- `Debug` uses `http://localhost:4040` and keeps the local OTP test hook available.
- `Staging` targets `https://api-staging.ponti.io`.
- `Release` targets `https://api.ponti.io`.
- Staging and Release disable the local OTP test hook.
- Associated domains and passkey entitlements resolve from the active build configuration.

## Passkeys

The app uses the Better Auth passkey endpoints exposed by the API. For real passkey registration and sign-in, the backend passkey RP ID, origin, and associated domains must line up with the signed app entitlement.

## Local auth smoke test

1. Start the API with `AUTH_TEST_OTP_ENABLED=true` and `AUTH_E2E_SECRET=otp-secret`.
2. Run the macOS app with `HOMINEM_AUTH_TEST_SECRET=otp-secret`.
3. Enter an email, send a code, use `Fetch local test code`, then verify.

## Scripted macOS E2E

Run `bun run test:apple:macos-e2e` from the repo root.

The harness will:

- clean API auth test state
- boot the local API in test mode
- generate the Xcode project
- build and ad-hoc sign the macOS app and UI test runner
- run the email OTP sign-in and sign-out flow against the live local API

## Release packaging

Set `APPLE_TEAM_ID` before archive commands.

- `bun run build:apple:ios:archive`
- `bun run build:apple:macos:archive`

Set `APPLE_NOTARY_PROFILE` as an `xcrun notarytool` keychain profile to notarize the macOS export.

- `bun run build:apple:macos:notarize`

Optional environment variables:

- `HOMINEM_APPLE_CONFIGURATION` defaults to `Release`
- `HOMINEM_APPLE_BUILD_DIR` defaults to `build/apple`
- `APPLE_ALLOW_PROVISIONING_UPDATES=1` adds `-allowProvisioningUpdates` to the archive/export commands
