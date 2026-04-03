# Hakumi Mobile

A React Native Expo app with comprehensive scripts, CI/CD automation, and production-ready architecture.

## Quick Start

### One-Minute Setup

```bash
# Install dependencies
bun install

# Start development
npm run dev

# Open another terminal - run tests
npm run test
```

Done! You're running the app on iOS simulator with test watcher active.

### Daily Commands

```bash
npm run dev                    # Start dev server
npm run dev:sim               # Switch to simulator
npm run dev:device            # Switch to physical iPhone
npm run lint                  # Check code quality
npm run format                # Auto-fix formatting
npm run test                  # Run all tests
npm run typecheck             # Check TypeScript
```

### Before Committing

```bash
npm run format                # Format code
npm run typecheck             # Type check
npm run test                  # Run tests
npm run verify:dev            # Verify config
git push origin feature/name   # Push when all pass
```

---

## Architecture Overview

### Variant Model

The app supports 4 distinct variants, each with specific configuration, environment, and branding:

| Aspect           | dev                      | e2e                   | preview                   | production        |
| ---------------- | ------------------------ | --------------------- | ------------------------- | ----------------- |
| **Purpose**      | Local development        | E2E testing           | Internal testing          | App store         |
| **API**          | localhost:4040           | localhost:4040        | EAS-managed               | EAS-managed       |
| **Icon**         | `logo.hakumi.dev.png`    | `logo.hakumi.dev.png` | `logo.hakumi.preview.png` | `logo.hakumi.png` |
| **Environment**  | `.env.development.local` | `.env.e2e.local`      | EAS secrets               | EAS secrets       |
| **Dev Client**   | ✅ Enabled               | ❌ Disabled           | ❌ Disabled               | ❌ Disabled       |
| **Channel**      | `development`            | (e2e only)            | (testing)                 | `production`      |
| **Distribution** | N/A                      | simulator             | TestFlight/Firebase       | App Store/Play    |

### Native Generation Rules

- **dev & e2e:** Use local `.env.*.local` files (git-ignored)
- **preview & production:** Use EAS-managed environment variables (encrypted, secure)
- Never mix local env files with release variants

### Runtime Scope

Each variant loads specific configuration at runtime:

- `APP_VARIANT` environment variable selects app behavior
- Icons generated per variant at build time
- API endpoints configured per environment
- Feature flags differ by variant (e.g., dev only: debug menu)

### Environment Model

#### Development (dev)

```bash
# .env.development.local
EXPO_PUBLIC_API_BASE_URL="http://localhost:4040"
# Local backend running on port 4040
# Fast refresh enabled via dev-client
```

**Commands:**

```bash
npm run dev                 # Start with verification
npm run dev:sim            # Simulator target
npm run dev:device         # Physical device target
```

### E2E (e2e)

```bash
# .env.e2e.local
EXPO_PUBLIC_API_BASE_URL="http://localhost:4040"
# Same as dev, but built as release app for testing
```

**Detox simulator config:**

- Default simulator device is configurable via `DETOX_SIMULATOR_DEVICE`
- Default simulator OS is configurable via `DETOX_SIMULATOR_OS`
- If unset, the build uses a safer default device instead of a hardcoded unavailable runtime

**Commands:**

```bash
npm run build:e2e              # Build test app with Detox
npm run test:e2e               # Run auth flow tests
npm run test:e2e:deep-links    # Run deep links tests
npm run test:e2e:smoke         # Run smoke tests
```

#### Preview

- **Environment:** EAS-managed `preview` environment
- **Distribution:** TestFlight (iOS) + Firebase (Android)
- **Audience:** Internal testers, QA
- **Version:** Auto-increments
- **Submission:** Manual from local or automatic on main branch

#### Production

- **Environment:** EAS-managed `production` environment
- **Distribution:** App Store (iOS) + Google Play (Android)
- **Audience:** Public users
- **Version:** Auto-increments, cannot rebuild same version
- **Submission:** Manual workflow dispatch only (requires confirmation)

### Local Development Notes

1. Create `.env.development.local` (git-ignored):

   ```bash
   EXPO_PUBLIC_API_BASE_URL="http://localhost:4040"
   ```

2. Ensure backend API runs on port 4040

3. Use `npm run dev:device` to switch to physical iPhone:
   - iPhone must be plugged in and trusted
   - Mac and iPhone must be on same Wi-Fi
   - LAN IP auto-detected

4. Each variant can have different source code paths, features, and behavior

---

## Source Of Truth

- **App Configuration:** `app.config.ts` (Expo config)
- **EAS Profiles:** `eas.json` (all 4 variants: dev, e2e, preview, production)
- **Constants:** `config/expo-config.js` (owner, project ID, slug)
- **Environment Policy:** `config/release-env-policy.js` (validation rules)
- **App Variant Logic:** `config/appVariant.ts` (variant-specific behavior)

---

## Verification Surfaces

All verification checks are consolidated in `npm run verify:VARIANT`:

### Always Checked

- ✅ EAS profiles exist (all 4 required)
- ✅ Expo configuration matches expected values
- ✅ Design tokens used (no raw spacing numbers)

### Variant-Specific (preview/production only)

- ✅ Release environment variables set in EAS

```bash
npm run verify:dev         # Quick check (always works)
npm run verify:e2e         # E2E config (always works)
npm run verify:preview     # Requires EAS_TOKEN
npm run verify:production  # Requires EAS_TOKEN
```

---

## Detox Auth Model

E2E tests use Detox with a simulated auth flow:

- Built as non-dev-client app (release mode)
- Runs on iOS simulator only (configured in `.detoxrc.js`)
- Tests auth state machine, deep links, basic smoke tests
- Detox app config in `.detoxrc.js`

**Commands:**

```bash
npm run build:e2e              # Build app for testing
npm run test:e2e               # Run auth flow tests
npm run test:e2e:deep-links    # Deep links
npm run test:e2e:smoke         # Smoke tests
```

---

## Release Surface

### Preview Release

```bash
npm run build:preview          # Submit to EAS
```

- Verifies preview configuration
- Builds for both iOS and Android
- Submits to TestFlight (iOS) and Firebase (Android)
- Testers receive build notification
- Check status at https://expo.dev

### Production Release

```bash
# GitHub Actions (manual only)
# 1. Go to: Actions > "Mobile · Build Production"
# 2. Click "Run workflow"
# 3. Type confirmation: "yes-produce"
# 4. Builds submit to App Store and Google Play
```

- Requires explicit confirmation (cannot be triggered by accident)
- Version auto-increments
- Auto-submitted to app stores
- Check status at https://expo.dev

---

## Device Auth Smoke Checklist

Before releasing, verify on device:

- [ ] Login works (auth flow)
- [ ] Logout works
- [ ] Deep links work (if app scheme configured)
- [ ] Push notifications work (if configured)
- [ ] Offline mode handles gracefully

---

## Auth Readiness

Key requirements for auth to work:

- [ ] Better Auth configured
- [ ] Passkey support enabled
- [ ] Auth state machine in place
- [ ] Token storage (Secure Store)
- [ ] Route guards protecting screens
- [ ] Error boundaries catching auth errors

---

## Architecture

### Auth State Machine

The app uses a state machine for auth flow:

- **Initial:** Check stored token
- **Loading:** Awaiting auth check
- **Authenticated:** User logged in, token valid
- **Unauthenticated:** No valid token
- **Error:** Auth failed, show error

See `tests/auth-state-machine.test.ts` for full specification.

### Error Boundaries

Error boundaries catch unhandled exceptions:

- **Auth errors:** Logged and user directed to login
- **Network errors:** User sees error screen with retry
- **Unknown errors:** Fallback error screen with support contact

Error boundaries configured in `app/(root)/` layouts.

### State Consolidation

Auth state centralized in context provider:

- `contexts/AuthContext.ts` provides auth state to entire app
- Route guards check auth before rendering protected screens
- Startup metrics track auth boot time

### Runtime Validation

Auth token validated on app startup:

- Stored token retrieved from secure store
- Token sent to backend for validation
- Invalid tokens cleared, user logged out
- Metrics recorded (boot time, success/failure)

### Performance Optimizations

- Token cached in React Query
- Prefetch queries on successful auth
- Debounce auth state changes
- Minimize re-renders with proper memoization

---

## iOS IDs

- **Bundle ID (dev):** `com.hakumi.dev`
- **Bundle ID (preview):** `com.hakumi.preview`
- **Bundle ID (production):** `com.hakumi`
- **Team ID:** (from Apple Developer account)
- **Provisioning Profiles:** Managed by EAS

---

## Development Workflow

### Daily Development Loop

```bash
# 1. Start dev
npm run dev
# Opens simulator/device with dev server

# 2. Throughout day - test as you code
npm run test:unit:auth          # Quick feedback
npm run lint                     # Code quality
npm run typecheck                # Types

# 3. Before committing
npm run format && npm run lint && npm run typecheck && npm run test
npm run verify:dev
git push origin feature/name
```

### Pre-PR Checklist

```bash
npm run format              # Auto-fix style
npm run typecheck           # Verify types
npm run test                # All tests
npm run verify:dev          # Verify configuration
npm run build:e2e           # Build e2e app (if UI changed)
npm run test:e2e            # E2E auth tests
```

### E2E Testing Workflow

```bash
# First time or after major changes
npm run build:e2e           # Build (~10 min)

# Optional: choose a simulator runtime if your default differs
export DETOX_SIMULATOR_DEVICE="iPhone 16 Pro"
export DETOX_SIMULATOR_OS="26.2"

# Then run test suites
npm run test:e2e            # Auth flow tests
npm run test:e2e:deep-links # Deep links tests
npm run test:e2e:smoke      # Smoke tests

# Or run all:
npm run build:e2e && \
npm run test:e2e && \
npm run test:e2e:deep-links && \
npm run test:e2e:smoke
```

### Switching Dev Target

```bash
# Currently on simulator?
npm run dev:device          # Switch to device
npm run dev                 # Start with device target

# Currently on device?
npm run dev:sim             # Switch to simulator
npm run dev                 # Start with simulator target

# Not sure?
npm run dev:select          # Show current target
```

---

## Command Reference

### Development Commands

```bash
npm run dev                 # Start dev server with verification
npm run dev:sim             # Switch to simulator (localhost)
npm run dev:device          # Switch to device (LAN IP auto-detect)
npm run dev:select          # Show current target status
```

**Details:**

- `dev` - Runs verify, then starts `expo start --dev-client`
- `dev:sim` - Updates `.env.development.local` to `localhost:4040`
- `dev:device` - Updates `.env.development.local` to device LAN IP
- All load environment from `.env.development.local`

### Verification Commands

```bash
npm run verify:dev          # Verify dev configuration
npm run verify:e2e          # Verify e2e configuration
npm run verify:preview      # Verify preview config (requires EAS_TOKEN)
npm run verify:production   # Verify production config (requires EAS_TOKEN)
```

**Checks:**

- ✅ EAS profiles valid
- ✅ Expo config matches expected
- ✅ Design tokens used (no raw numbers)
- ✅ Release env vars set (preview/production only)

### Testing Commands

```bash
npm run test                # All tests (unit + integration)
npm run test:unit:auth      # Unit tests only
npm run test:integration:auth  # Integration tests
npm run build:e2e           # Build e2e test app (~10 min)
npm run test:e2e            # E2E auth flow tests
npm run test:e2e:deep-links # E2E deep links tests
npm run test:e2e:smoke      # E2E smoke tests
```

### Building Commands

```bash
npm run build:preview       # Build preview release
npm run build:production    # Build production release (manual confirmation)
npm run build:e2e           # Build e2e test app
```

**Build Matrix:**
| Command | Variant | Platform | Distribution | Auto-Submit |
|---------|---------|----------|--------------|-------------|
| `build:preview` | preview | iOS + Android | TestFlight + Firebase | No |
| `build:production` | production | iOS + Android | App Store + Play | Yes |
| `build:e2e` | e2e | iOS simulator | Testing only | N/A |

### Quality Commands

```bash
npm run lint                # Linting + design token checks
npm run format              # Auto-fix code style
npm run typecheck           # TypeScript type checking
```

### Makefile Shortcuts

All npm scripts available as Make targets:

```bash
make help                   # Show all targets
make dev                    # npm run dev
make verify-dev             # npm run verify:dev
make build-preview          # npm run build:preview
make test                   # npm run test
make lint                   # npm run lint
make precommit              # format + lint + typecheck + test
make pr                     # Full PR verification
```

---

## CI/CD System

### Workflows Overview

| Workflow                      | Trigger          | Purpose                    |
| ----------------------------- | ---------------- | -------------------------- |
| `mobile-lint.yml`             | PR, main/develop | Linting + type checking    |
| `mobile-test.yml`             | PR, main/develop | Unit + integration tests   |
| `mobile-verify.yml`           | PR, main/develop | Configuration verification |
| `mobile-e2e.yml`              | PR, main/develop | E2E tests (parallel)       |
| `mobile-build-preview.yml`    | Push to main     | Auto-submit preview        |
| `mobile-build-production.yml` | Manual dispatch  | Production build           |

### What Runs on Every PR

- ✅ Linting & formatting checks
- ✅ TypeScript type checking
- ✅ Unit tests
- ✅ Integration tests
- ✅ Configuration verification
- ✅ E2E tests (build once, test all suites in parallel)

All jobs run in parallel for speed.

### What Runs on Push to `main`

- ✅ All PR checks above
- ✅ Automatic preview build (submitted to EAS)
- ✅ Slack notification (if configured)

### What Requires Manual Trigger

- 🚀 Production build (GitHub Actions workflow dispatch only)
- Requires explicit confirmation: `"yes-produce"`
- Cannot be accidentally triggered

### E2E Optimization

E2E workflow builds app once, shares to all test suites:

```
build-e2e-app → (artifacts)
              ├→ e2e-auth
              ├→ e2e-deep-links
              └→ e2e-smoke
```

**Detox destination:** The simulator target is configurable with `DETOX_SIMULATOR_DEVICE` and `DETOX_SIMULATOR_OS`.

**Impact:** Build once (~10 min) instead of 3 times

### Performance

- Parallel job execution: Lint + Type + Unit + Integration run simultaneously
- Artifact sharing: E2E app built once, tested 3 ways
- Dependency caching: node_modules cached across runs
- **Total PR time:** ~15 minutes (instead of 30+ sequentially)

---

## Script Architecture

### Directory Structure

```
scripts/
├── _lib.sh                          # Shared output helpers
├── verify.sh                        # Main verification orchestrator
├── dev.sh                           # Dev server orchestrator
├── dev-target.sh                    # Simulator/device switcher
├── preflight.sh                     # Pre-build verification
├── build-preview.sh                 # Preview build orchestrator
├── build-production.sh              # Production build orchestrator
├── build-e2e.sh                     # E2E app build orchestrator
│
└── internal/                        # Utility scripts (don't call directly)
    ├── check-eas-profiles.sh        # Validate EAS configuration
    ├── check-expo-config.sh         # Validate Expo configuration
    ├── check-release-env.sh         # Validate release env vars
    ├── check-style-tokens.ts        # Audit design token usage
    ├── ensure-ios-variant.sh        # Configure iOS for variant
    └── run-variant.sh               # Execute with variant env
```

### Design Principles

1. **Clear Naming** - Names indicate purpose: `verify`, `dev`, `build-*`, `check-*`
2. **Single Responsibility** - Each script does one thing well
3. **Composability** - Orchestrators chain smaller scripts
4. **Variant-Aware** - All 4 variants explicitly supported
5. **Environment Isolation** - Dev uses local files, release uses EAS

### Script Execution Flow

**Development workflow:**

```
npm run dev
  └─ scripts/dev.sh
       ├─ scripts/verify.sh dev (parallel checks)
       │   ├─ check-eas-profiles.sh
       │   ├─ validate-expo-config.ts
       │   └─ check-style-tokens.sh
       │
       └─ scripts/internal/run-variant.sh dev
            └─ expo start --dev-client
```

**Preview build workflow:**

```
npm run build:preview
  └─ scripts/build-preview.sh
       ├─ scripts/verify.sh preview
       ├─ scripts/preflight.sh preview
       │
       └─ eas build --platform all --profile preview
```

Expo generates launcher icons and splash assets from `app.config.ts` during prebuild/EAS Build. The canonical source images live in `apps/mobile/assets/`.

---

## Troubleshooting

### ❌ "EAS profiles validation failed"

**Cause:** One or more EAS profiles missing or misconfigured

**Fix:**

```bash
npm run verify:dev
```

Check `eas.json` has all 4 profiles: `development`, `e2e`, `preview`, `production`

Each profile must have:

- Correct `channel` (dev: `development`, prod: `production`)
- Correct `APP_VARIANT` (dev, e2e, preview, or production)
- Correct `developmentClient` setting (dev: true, others: false)

### ❌ "Expo config mismatch"

**Cause:** Expo config doesn't match expected values

**Fix:**

```bash
bunx expo config --json --type public
```

Compare with `config/expo-config.js`. Check:

- Owner matches `EXPO_OWNER`
- Project ID matches `EXPO_PROJECT_ID`
- Slug matches `EXPO_PROJECT_SLUG`
- `extra.mobilePasskeyEnabled` is present

### ❌ "Design tokens validation failed"

**Cause:** Raw spacing numbers used instead of theme tokens

**Fix:**

```bash
# ❌ Don't do this:
const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});

// ✅ Do this:
import { useTheme } from '@shopify/restyle';
const { t } = useTheme();

const styles = StyleSheet.create({
  container: {
    padding: t.spacing.md,
  },
});
```

Run `npm run lint` to identify violations.

### ❌ Device not detected with `npm run dev:device`

**Cause:** iPhone not plugged in, not trusted, or different network

**Fix:**

1. Plug in iPhone
2. Tap "Trust" on device
3. Ensure same Wi-Fi network
4. Run `npm run dev:select` to list connected devices
5. Manual fix: Edit `.env.development.local`:
   ```bash
   EXPO_PUBLIC_API_BASE_URL="http://192.168.1.100:4040"
   ```
   (Replace with your actual LAN IP)

### ❌ E2E tests failing

**Cause:** E2E app out of sync with code changes

**Fix:**

```bash
npm run build:e2e        # Rebuild app
npm run test:e2e         # Re-run tests
```

### ❌ APP_VARIANT not defined

**Cause:** EAS profile doesn't set `env.APP_VARIANT`

**Fix:** Check `eas.json`:

```json
{
  "build": {
    "development": {
      "env": {
        "APP_VARIANT": "dev"
      }
    }
  }
}
```

### ❌ Tests failing locally but passing in CI

**Cause:** Environment difference (Node version, dependencies, etc.)

**Fix:**

```bash
bun install --frozen-lockfile  # Match exact versions
npm run test                   # Run full test suite
```

### ❌ Build stuck or timing out

**Cause:** EAS overloaded or network issue

**Fix:**

1. Check EAS status: https://expo.dev
2. Wait a few minutes
3. Retry the build
4. If persistent, check GitHub Actions logs

---

## Environment Files

### Development (`.env.development.local`)

```bash
# Git-ignored - never commit
EXPO_PUBLIC_API_BASE_URL="http://localhost:4040"
```

### E2E (`.env.e2e.local`)

```bash
# Git-ignored - never commit
EXPO_PUBLIC_API_BASE_URL="http://localhost:4040"
# Add other e2e-specific variables
```

### Preview & Production

- Managed via **EAS Environment Variables** (encrypted)
- Set in `eas.json` under each build profile
- Loaded at build time by EAS
- More secure than local env files

---

## Security & Secrets

### GitHub Actions Secrets

Set these in GitHub repository settings:

```
EXPO_TOKEN           # Expo CLI authentication (required)
SLACK_WEBHOOK_URL    # For build notifications (optional)
```

Never commit secrets or API keys.

### Local Development

- `.env.development.local` is git-ignored
- `.env.e2e.local` is git-ignored
- Never commit `.env.*` files
- Use EAS environment variables for release builds

### Production Build Safety

- Requires manual GitHub workflow dispatch
- Requires explicit confirmation: `"yes-produce"`
- Cannot be triggered by accident
- Logs all production build activity
- Version auto-increments (cannot rebuild same version)

---

## Performance Tips

### Fastest Feedback Loop

```bash
npm run test:unit:auth       # ~30 seconds
npm run lint                 # ~30 seconds
```

### Pre-Commit Verification

```bash
make precommit               # ~2 minutes
# Runs: format + lint + typecheck + test
```

### Full PR Verification (Local)

```bash
make pr                      # ~15 minutes
# Runs: format + lint + typecheck + test + build:e2e + test:e2e
```

### CI Performance

- **Lint + Typecheck + Unit + Integration:** ~5 minutes (parallel)
- **E2E:** ~15 minutes (build once, test 3 ways in parallel)
- **Total PR:** ~15 minutes (jobs run in parallel)

### Optimization Tips

```bash
# Watch mode for faster iteration
bun run test --watch

# Test single file
vitest run tests/auth-validation.test.ts

# Build and test e2e in one command
npm run build:e2e && npm run test:e2e

# Run specific e2e suite
npm run test:e2e:smoke
```

---

## Common Workflows

### Release Preview Workflow

```bash
# Local machine
npm run build:preview        # Submit to EAS
# or wait for automatic build on main

# Check status
# Visit: https://expo.dev

# When ready, distribute to testers
# iOS: Add testers in Apple TestFlight
# Android: Add testers in Firebase Console

# Test in the wild, then fix issues if needed
npm run build:preview        # Submit new preview build
```

### Production Release Workflow

```bash
# Ensure all tests pass on main branch
# Then go to GitHub Actions

# 1. Find "Mobile · Build Production" workflow
# 2. Click "Run workflow"
# 3. Type confirmation: "yes-produce"
# 4. Workflow submits to app stores

# Monitor:
# - iOS: App Store Connect review status
# - Android: Google Play Console rollout status

# Once approved, app goes live!
```

### Local Dev Iteration

```bash
# Start dev
npm run dev

# Make code changes

# Quick tests as you code
npm run test:unit:auth
npm run lint
npm run typecheck

# Larger changes - run full test suite
npm run test

# Before committing
make precommit

# Push!
git push origin feature/name
```

---

## Getting Help

1. **Quick reference?** → Start here (README.md)
2. **Specific command?** → Search "Command Reference" section
3. **How something works?** → See "Architecture" section
4. **Common issues?** → See "Troubleshooting" section
5. **Scripts design?** → See "Script Architecture" section

### Useful Links

- **Expo Documentation:** https://docs.expo.dev
- **EAS Build:** https://docs.expo.dev/eas-update/introduction/
- **Detox E2E Tests:** https://wix.github.io/Detox/
- **Better Auth:** https://better-auth.com
- **App Store Connect:** https://appstoreconnect.apple.com
- **Google Play Console:** https://play.google.com/console
- **EAS Dashboard:** https://expo.dev

### Running Commands

```bash
npm run          # See all available npm scripts
make help        # See all Makefile targets
npm run verify:dev  # Verify configuration
npm run test     # Run all tests
```

---

## File Structure Overview

```
apps/mobile/
├── app/                         # Expo Router screens
├── components/                  # Reusable components
├── lib/                         # Business logic, utilities
├── utils/                       # Helper functions
├── theme/                       # Design tokens, styling
├── config/                      # Configuration (expo, auth, variants)
├── credentials/                 # OAuth credentials (git-ignored)
├── e2e/                         # E2E test suites (Detox)
├── tests/                       # Unit & integration tests
│
├── scripts/                     # Build & development scripts
│   ├── internal/                # Utility scripts
│   └── *.sh                     # Orchestration scripts
│
├── app.config.ts                # Expo configuration
├── eas.json                     # EAS build profiles
├── metro.config.js              # Metro bundler config
├── react-native.config.js       # React Native config
├── babel.config.js              # Babel config
├── Makefile                     # Make shortcuts
├── README.md                    # This file
├── COMMAND_REFERENCE.md         # Detailed command specs
├── QUICK_START.md               # Quick start guide
└── package.json                 # Dependencies & npm scripts
```

---

## Next Steps

1. **Clone the repo** and install dependencies:

   ```bash
   bun install
   ```

2. **Create environment file:**

   ```bash
   echo 'EXPO_PUBLIC_API_BASE_URL="http://localhost:4040"' > .env.development.local
   ```

3. **Start developing:**

   ```bash
   npm run dev
   ```

4. **Run tests:**

   ```bash
   npm run test
   ```

5. **Before committing:**

   ```bash
   make precommit
   ```

6. **Deploy preview:**

   ```bash
   npm run build:preview
   ```

7. **Deploy production:**
   - GitHub Actions → Mobile · Build Production
   - Type: `"yes-produce"`

---

## Key Takeaways

✅ **4 variants:** dev (local), e2e (testing), preview (internal), production (public)  
✅ **Clear naming:** Scripts self-document purpose and timing  
✅ **Mandatory variants:** `verify:dev`, `verify:preview`, etc. (no ambiguity)  
✅ **Composable:** Orchestrator scripts chain smaller utilities  
✅ **Comprehensive CI/CD:** 6 automated workflows  
✅ **Safety first:** Production builds require confirmation  
✅ **Performance optimized:** Parallel execution, artifact sharing  
✅ **Well documented:** Troubleshooting, examples, links

Start with `npm run dev` and explore from there. All commands are self-documenting through `npm run` and `make help`.
