## Why

The current mobile CI/CD setup is misaligned with how the team actually works:

- EAS builds run on every `push` to both `main` and `develop`, but only `main` should publish to TestFlight
- The workflow uses `--profile preview`, which builds for internal ad-hoc distribution, not TestFlight
- There is no `eas.json`, so build profiles aren't explicitly defined
- Detox E2E is a local developer tool (requires macOS + simulator) but was being considered for CI, which is architecturally incompatible
- The `eas-build` job produces artifacts that are never consumed

## What Changes

- Create `apps/mobile/eas.json` with explicit `development`, `preview`, and `production` build profiles
- Update `.github/workflows/mobile-checks.yml`:
  - Change CI trigger from `push to [main, develop]` → `push to main` for EAS build
  - Change `--profile preview` to `--profile production`
  - Add `eas submit` step to push the built artifact to TestFlight
- Remove `eas-build` job from `pull_request` trigger (EAS builds are not needed on PRs)
- Keep `mobile-checks` (tsc + jest) running on all PRs and pushes to `main`/`develop`
- Detox scripts and `mobile-e2e` justfile recipe remain as local developer tools — not part of CI
- No change to `app.config.ts` or any application code

## Capabilities

### New Capabilities
- `mobile-ci-pipeline`: Defines the mobile CI/CD pipeline behavior — what triggers builds, which profile is used, and how artifacts are published
  - Trigger: push to `main`
  - Build: `eas build --platform ios --profile production`
  - Publish: `eas submit --platform ios --latest`
  - Dev CI: push to `develop` or PR → only typecheck + jest (no EAS build)

### Modified Capabilities
- *(none)* — no product requirements change

## Impact

- `.github/workflows/mobile-checks.yml` — simplified to run EAS build+submit only on `main`
- `apps/mobile/eas.json` — new file, defines build profiles for EAS CLI
- `justfile` — `mobile-e2e` recipe stays (local-only tool, no CI change needed)
- `apps/mobile/package.json` — `detox:*` scripts stay (local developer tools)
- `apps/mobile/.detoxrc.json` — stays (local config)
