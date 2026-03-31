# Hakumi Mobile (iOS)

This app is the iOS client for Hakumi, the notes-first personal workspace, built with Expo Router and Better Auth-backed API flows.

## Variant Model

The mobile app uses explicit runtime variants. `APP_VARIANT` controls app identity, native generation, and local env loading.

| Variant      | Purpose                           | Native Shape                    | OTA Updates        | Primary Command         |
| ------------ | --------------------------------- | ------------------------------- | ------------------ | ----------------------- |
| `dev`        | local feature development         | Expo dev client + Metro         | disabled           | `make mobile.dev`       |
| `e2e`        | deterministic mobile test runtime | standalone native test app      | disabled           | `make mobile.e2e.build` |
| `preview`    | internal QA / release candidate   | standalone update-enabled build | preview channel    | `make mobile.rc`        |
| `production` | App Store / TestFlight            | standalone update-enabled build | production channel | `make mobile.release`   |

## Native Generation Rules

- `APP_VARIANT` is the single source of truth for app identity, bundle identifier, URL scheme, dev-client inclusion, and Expo updates behavior.
- The main app's shared app-group entitlement derives from the active bundle identifier.
- Only `dev` includes `expo-dev-client` and connects to Metro.
- `e2e`, `preview`, and `production` exclude the dev client and generate standalone native projects.
- Only `dev` and `e2e` may source local `.env.*.local` files. `preview` and `production` must use EAS-managed environments.
- `bun run prebuild:dev` and `bun run prebuild:e2e` are variant-aware and regenerate `ios/` when the requested native shape changes.
- Do not hand-edit generated `ios/Podfile`, `Expo.plist`, or project naming to switch variants. Regenerate through the variant prebuild scripts instead.

## Runtime Scope

- Production target: iOS only
- Authentication: Email + OTP via Better Auth API
- API: `@hominem/rpc` via authenticated HTTP requests

## Environment Setup

Use [apps/mobile/.env.example](.env.example) as the local starting point. Release values are enforced through EAS and the CI release workflows.

## Command Surface

Prefer repo-root Make targets for mobile platform work.

| Goal                                 | Root command                           |
| ------------------------------------ | -------------------------------------- |
| Start dev client                     | `make mobile.dev`                      |
| Lint                                 | `make mobile.lint`                     |
| Typecheck                            | `make mobile.typecheck`                |
| Auth gate                            | `make mobile.test`                     |
| Build iOS simulator binary           | `make mobile.e2e.build`                |
| Run Detox smoke                      | `make mobile.e2e.smoke`                |
| Verify local Expo config             | `make mobile.check.expo-config`        |
| Release candidate gate               | `make mobile.rc`                       |
| Release candidate gate + Detox smoke | `make mobile.rc.smoke`                 |
| Publish preview OTA                  | `make mobile.ota.publish.preview`      |
| Production release gate              | `make mobile.release`                  |
| Build production binary              | `make mobile.release.build.production` |
| Submit latest production build       | `make mobile.release.submit.production` |

## Development

From monorepo root:

```bash
make mobile.dev
```

From mobile app directory (`dev` variant):

```bash
bun run start
```

### Variant-specific prebuild

```bash
bun run prebuild:dev
bun run prebuild:e2e
```

If you switch from simulator Detox work back to a physical-device dev build, run `bun run prebuild:dev` before `bun run ios` so the generated iOS project includes the dev launcher again.

### Local device signing

- Use the mobile env example to configure Apple signing before generating or building a physical-device `dev` app.
- Only enable the mobile passkey toggle when you are actively validating that surface.
- Expo maps `ios.appleTeamId` from app config into the generated Xcode project for `dev` builds, which keeps local device signing reproducible after a clean prebuild.
- The `e2e` simulator workflow does not require a development team.

## Detox E2E

### Prerequisites

- Xcode command line tools
- iOS simulator available (`iPhone 16 Pro`)
- `applesimutils` installed (`brew tap wix/brew && brew install applesimutils`)
- API server running and configured for non-production E2E auth (`AUTH_E2E_ENABLED=true`) when you run the OTP auth or deep-link Detox lanes

### Run E2E

```bash
# build clean simulator binary (no dev client)
make mobile.e2e.build

# targeted smoke gate
make mobile.e2e.smoke

# macOS-only release-candidate gate
make mobile.rc.smoke

# deeper auth lane
bun run test:e2e:auth

# full mobile Detox suite
bun run test:e2e:all
```

### Auth model in E2E

- Mobile auth is email + OTP across development and E2E.
- E2E tests request OTP via `/api/auth/email-otp/send` and fetch deterministic OTP via `/api/auth/test/otp/latest`.
- OTP lookup requires `x-e2e-auth-secret` matching `AUTH_E2E_SECRET` on API.
- Test OTP retrieval remains disabled in production.
- Detox selectors are `testID`-driven:
  - `auth-screen`
  - `auth-email-input`
  - `auth-send-otp`
  - `auth-otp-input`
  - `auth-verify-otp`
  - `account-screen`
  - `account-sign-out`

## Auth Testing

```bash
make mobile.test
make mobile.e2e.build
make mobile.e2e.smoke
make mobile.rc.smoke
bun run test:e2e:auth
bun run test:e2e:all
```

- `make mobile.test` is the canonical mobile auth verification lane.
- `make mobile.rc.smoke` is the release-candidate simulator gate run in CI on macOS.
- `make mobile.e2e.smoke` and `make mobile.rc.smoke` only validate clean boot and do not require a live backend.
- `test:e2e:auth` remains the focused native auth lane when you need deeper mobile auth coverage.
- `test:e2e:all` exists for full native coverage, but it is not the default gate yet.
- `jest-expo` plus React Native Testing Library cover auth screen behavior.
- A dedicated route-level auth harness covers Expo Router navigation and deep-link hydration.
- Detox covers native-critical auth and relaunch flows.
- personal-device smoke covers final hardware-specific auth validation.
- Mobile passkey buttons are hidden by default.
- The `mobile-release-candidate` workflow uploads Detox logs, screenshots, and videos when smoke fails.

## EAS Builds

### Prerequisites

1. **Apple Developer Account** with App Store Connect access
2. **EAS CLI** installed: `npm install -g eas-cli@10.0.3`
3. **Expo account** linked: `eas login`

### Setup Credentials

```bash
# Configure Apple API key for EAS (required for CI)
eas credentials

# Or configure the matching Apple credentials in your CI or shell environment.
```

### Build Commands

```bash
make mobile.rc
make mobile.ota.publish.preview
make mobile.release
make mobile.release.build.production
make mobile.release.submit.production
```

### TestFlight Deployment

For production TestFlight deployment, ensure Apple credentials are configured:

```bash
make mobile.release
make mobile.release.build.production
make mobile.release.submit.production
```
