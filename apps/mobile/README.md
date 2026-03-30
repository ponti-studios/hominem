# Hakumi Mobile (iOS)

This app is the iOS client for Hakumi, the notes-first personal workspace, built with Expo Router and Better Auth-backed API flows.

## Variant Model

The mobile app uses explicit runtime variants. `APP_VARIANT` controls app identity, native generation, and local env loading.

| Variant      | Purpose                           | Native Shape                    | OTA Updates        | Primary Command            |
| ------------ | --------------------------------- | ------------------------------- | ------------------ | -------------------------- |
| `dev`        | local feature development         | Expo dev client + Metro         | disabled           | `bun run start`            |
| `e2e`        | deterministic mobile test runtime | standalone native test app      | disabled           | `bun run test:e2e:build`   |
| `preview`    | internal QA / release candidate   | standalone update-enabled build | preview channel    | `bun run build:preview`    |
| `production` | App Store / TestFlight            | standalone update-enabled build | production channel | `bun run build:production` |

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

## Development

From monorepo root:

```bash
bun run dev --filter @hominem/mobile
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
- iOS simulator available (`iPhone 17 Pro`)
- `applesimutils` installed (`brew tap wix/brew && brew install applesimutils`)
- API server running and configured for non-production E2E auth (`AUTH_E2E_ENABLED=true`)

### Run E2E

```bash
# build clean simulator binary (no dev client)
bun run test:e2e:build

# current critical auth lane
bun run test:e2e:auth

# full mobile Detox suite
bun run test:e2e:all

# targeted smoke
bun run test:e2e:smoke
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
bun run test
bun run test:auth:unit
bun run test:auth:integration
bun run test:e2e:build
bun run test:e2e:auth
bun run test:e2e:all
bun run test:e2e:smoke
```

- `test` is the canonical mobile auth verification lane.
- `test:e2e:auth` is the current CI-critical Detox lane.
- `test:e2e:all` exists for full native coverage, but it is not the default gate yet.
- `jest-expo` plus React Native Testing Library cover auth screen behavior.
- A dedicated route-level auth harness covers Expo Router navigation and deep-link hydration.
- Detox covers native-critical auth and relaunch flows.
- personal-device smoke covers final hardware-specific auth validation.
- Mobile passkey buttons are hidden by default.

## EAS Builds

### Prerequisites

1. **Apple Developer Account** with App Store Connect access
2. **EAS CLI** installed: `npm install -g eas-cli`
3. **Expo account** linked: `eas login`

### Setup Credentials

```bash
# Configure Apple API key for EAS (required for CI)
eas credentials

# Or configure the matching Apple credentials in your CI or shell environment.
```

### Build Commands

```bash
bun run build:development
bun run build:e2e
bun run build:preview
bun run build:production
bun run build:update:preview
bun run build:update:production
```

### TestFlight Deployment

For production TestFlight deployment, ensure Apple credentials are configured:

```bash
# Build for production
bun run build:production

# Submit to TestFlight (requires credentials)
eas submit --platform ios --latest
```
