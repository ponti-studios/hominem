## Context

The mobile app (`apps/mobile`) uses Expo with four runtime variants defined in `app.config.ts`:

| Variant | Bundle ID | Distribution |
|---------|-----------|-------------|
| `dev` | `com.pontistudios.hakumi.dev` | Development (dev client) |
| `e2e` | `com.pontistudios.hakumi.e2e` | Local Detox E2E |
| `preview` | `com.pontistudios.hakumi.preview` | Internal ad-hoc |
| `production` | `com.pontistudios.hakumi` | App Store / TestFlight |

EAS Build is used to compile the native iOS binary. EAS Submit pushes the binary to Apple.

The Expo project is owned by `pontistudios` (slug: `hakumi`, projectId: `4dfac82b-644f-4ff3-be42-e8f941287aa1`). The Apple Team ID is `3QHJ2KN8AL`.

## Goals / Non-Goals

**Goals:**
- Developers can run the app on simulator and physical device for local development
- Every push to `main` publishes a new build to TestFlight via EAS
- CI is fast and cheap for non-release branches (only typecheck + unit tests)

**Non-Goals:**
- Automating E2E tests in CI (Detox requires macOS runner, too expensive for per-PR runs)
- Running EAS builds on `develop` pushes (waste of resources, no distribution)
- Changing application code or runtime behavior

## Decisions

### 1. Use `production` profile for TestFlight, not `preview`

The `preview` profile builds `com.pontistudios.hakumi.preview` with ad-hoc signing. This is for internal testing via Expo's direct-install mechanism, not TestFlight.

The `production` profile builds `com.pontistudios.hakumi` with App Store signing, which is what TestFlight requires.

**Decision**: Change CI EAS build from `--profile preview` to `--profile production`.

### 2. EAS build only on `main` branch

`develop` branch pushes should not trigger EAS builds because:
- No distribution target for `develop` builds
- Wastes EAS build minutes
- Creates confusion about which build is "current"

**Decision**: Move EAS build+submit into a separate job that only triggers on `push` to `main`, not on PRs.

### 3. Keep `mobile-checks` job on all pushes and PRs

Type checking and unit tests are fast, cheap (ubuntu runner), and provide good signal on every change.

**Decision**: Keep `mobile-checks` job running on `push` to `main`/`develop` AND on `pull_request` to those branches.

### 4. Detox stays local

Detox E2E requires:
- macOS runner (10x cost of ubuntu)
- xcodebuild against simulator
- applesimutils

EAS cloud builds produce signed binaries for real devices — incompatible with Detox's simulator-based approach.

**Decision**: Keep `detox:e2e` as a local developer script. No CI integration.

### 5. Create `eas.json` to formalize build profiles

Without `eas.json`, EAS CLI uses defaults that may not match the intended configuration.

**Decision**: Create `eas.json` with explicit `development`, `preview`, and `production` profiles matching the variants in `app.config.ts`.

## eas.json Structure

```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "appleTeamId": "3QHJ2KN8AL",
        "bundleIdentifier": "com.pontistudios.hakumi.dev"
      }
    },
    "preview": {
      "developmentClient": false,
      "distribution": "internal",
      "ios": {
        "appleTeamId": "3QHJ2KN8AL",
        "bundleIdentifier": "com.pontistudios.hakumi.preview"
      },
      "channel": "preview"
    },
    "production": {
      "developmentClient": false,
      "distribution": "store",
      "ios": {
        "appleTeamId": "3QHJ2KN8AL",
        "bundleIdentifier": "com.pontistudios.hakumi"
      },
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "ios": { "appleTeamId": "3QHJ2KN8AL" }
    }
  }
}
```

## Risks / Trade-offs

- **[Risk]** EAS Submit requires `EXPO_TOKEN` secret to be configured in GitHub Actions. If missing, the build succeeds but submit fails.
  - **Mitigation**: Verify `EXPO_TOKEN` is set in repo secrets before merging.

- **[Risk]** `production` profile builds for App Store distribution. Accidental trigger on a broken commit blocks TestFlight.
  - **Mitigation**: `mobile-checks` (tsc + jest) must be green before any `main` push. The EAS build+submit is the final step after checks pass.

- **[Trade-off]** No per-PR E2E in CI. E2E is only run locally by developers.
  - **Mitigation**: The `detox:e2e` script remains available for developers to run before merging significant changes.

## Migration Plan

1. Create `apps/mobile/eas.json`
2. Update `.github/workflows/mobile-checks.yml`:
   - Remove `eas-build` job from PR triggers
   - Move EAS build+submit to a `main`-only trigger
   - Change profile from `preview` to `production`
   - Add `eas submit` step
3. Verify `EXPO_TOKEN` secret exists in GitHub repo settings
4. Test by pushing to a test branch (dry run: `eas build --profile production --dry-run`)

No migration of existing artifacts or data is needed — this is purely CI/CD configuration.

## Open Questions

- Should `develop` branch pushes trigger `eas build --profile preview` for internal QA? If so, add a separate job. Currently: no EAS build on `develop`.
- Should `eas submit` auto-select the latest build or a specific build? Using `--latest` selects the most recent successful build, which is appropriate for CI.
