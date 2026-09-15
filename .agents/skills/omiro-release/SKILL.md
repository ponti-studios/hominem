---
name: omiro-release
description: Prepare, build, and release Omiro through local EAS artifacts, GitHub validation/deployment, or approval-gated EAS workflows. Use for readiness, TestFlight, App Store, OTA, EAS builds, and release troubleshooting.
---

# Omiro Release

Use this skill for Omiro production readiness and releases. It owns preflight,
local signed artifacts, GitHub-driven deployment, EAS workflows, TestFlight,
and JS-only OTA updates.

## Authorization boundary

Preflight checks are read-only or local and may run when asked for release
readiness. Building, publishing an OTA, uploading an IPA, merging/pushing to
`main`, and triggering an EAS workflow change external state. Do those only
when the user explicitly asks for that action. Never turn a readiness request
into a release.

## Choose the path

| Goal | Path | Result |
| --- | --- | --- |
| Determine release readiness | Preflight below | Evidence and blockers; no release |
| Normal CI release from `main` | GitHub Actions | `validate-mobile` → `deploy-mobile` → EAS approval → TestFlight |
| Create and upload an explicitly requested local IPA | `pnpm build:prod:local`, then `pnpm submit:local` | Locally signed IPA → App Store Connect/TestFlight |
| Ship a JS-only fix | `just mobile update "<message>"` | EAS approval → production OTA channel |

The cloud release workflow is
`apps/omiro/.eas/workflows/production-release.yml`; the OTA workflow is
`apps/omiro/.eas/workflows/ota-update.yml`.

For the detailed Sentry, production verification, local IPA, TestFlight, and
OTA operational reference, read
[references/production-operations.md](references/production-operations.md)
when the selected release path requires it.

## Preflight

Before recommending or starting a production release:

1. Inspect `git status --short --branch`. Do not call a dirty or uncommitted
   intended release ready.
2. Read `apps/omiro/README.md`, `apps/omiro/AGENTS.md`, `apps/omiro/eas.json`,
   and the applicable EAS workflow. Confirm the marketing version in
   `apps/omiro/app.config.js` is intentional, the production profile targets
   the store distribution, and EAS owns the iOS build-number increment.
3. Run `git diff --check`, then the narrow checks before the repository gate:

   ```bash
   pnpm --filter=@hominem/omiro format:check
   pnpm --filter=@hominem/omiro lint
   pnpm --filter=@hominem/omiro typecheck
   pnpm --filter=@hominem/omiro test
   npx react-doctor@latest --verbose --scope changed
   pnpm run check
   ```

   Run relevant Web/API checks when shared behavior or API contracts changed.
   Treat failures as blockers unless they are demonstrably pre-existing and
   reported with the exact command and failure.
4. Before a local Expo/EAS production command, resolve the production identity:

   ```bash
   export APP_ENV=production
   pnpm --filter=@hominem/omiro verify:release
   pnpm --filter=@hominem/omiro export:embed:ios
   ```

   The guard and embed must resolve to `Omiro` with
   `com.pontistudios.hakumi`. Fix environment resolution if they do not;
   never bypass `scripts/verify-release-identity.mjs`.
5. For native modules, permissions, app config, assets, entitlements, or a
   store binary, run `pnpm --filter @hominem/omiro prebuild:prod` and collect
   appropriate simulator/device evidence. `apps/omiro/ios` is CNG-generated:
   do not edit it.

For a readiness report, include blockers, commands/tests run, manual evidence,
unverified scope, and the next authorized action.

## GitHub and EAS cloud releases

`validate-mobile.yml` runs for the configured Omiro/shared paths on pull
requests and pushes to `main`. A successful `main` validation triggers
`deploy-mobile.yml`, which checks out that validated SHA and starts the EAS
production-release workflow with `EXPO_TOKEN`. The EAS workflow waits for
approval, builds iOS, asserts
`com.pontistudios.hakumi` and store distribution, then submits to TestFlight.

There is no routine local production-release command. Merging to `main` is the
single standard trigger, and the EAS approval job is the human release gate.
When recovering a failed trigger, rerun the exact validated SHA from GitHub or
the EAS dashboard; do not assemble a separate build/submit sequence from a
developer checkout.

The `build.base.pnpm` pin applies only to EAS build jobs. Submit and update
jobs need their own Corepack hook in the workflow; preserve the existing hook
and never loosen root pnpm supply-chain settings to work around a runner
version mismatch.

## Explicitly requested local IPA

`pnpm build:prod:local` runs `apps/omiro/scripts/build-prod-local.sh`. It
loads and exports gitignored `.eas-prod.local`, forces `APP_ENV=production`, checks
the production identity, and invokes `eas build --local`.

EAS Secret variables cannot be retrieved by a local build. Keep
`SENTRY_AUTH_TOKEN` only in `.eas-prod.local` or another local secret manager; do
not print, commit, or downgrade its EAS Secret visibility. The wrapper supplies
the `ponti-studios`/`omiro` Sentry org/project defaults. Do not use
`SENTRY_DISABLE_AUTO_UPLOAD` or `SENTRY_ALLOW_FAILURE` for a TestFlight IPA:
source maps and dSYMs must upload.

`pnpm submit:local` runs `apps/omiro/scripts/submit-prod-local.sh`. It selects
the expected local IPA, re-checks the production identity, prints the selected
path, and passes it explicitly to `eas submit --path`. Before submitting,
confirm the selected IPA is the intended artifact and that its App Store
Connect credentials are available.

## OTA updates

An IPA submission never creates an OTA. Use `just mobile update "<message>"`
only for an approved JS-only change. It starts the EAS approval-gated OTA
workflow on the production branch and affects only installed builds with a
matching runtime version. Native dependencies, permissions, config plugins,
or other native changes require a new store binary.

## Troubleshooting

- **Wrong app identity / `-19000`**: an ambient `.env.*.local` value likely
  selected the dev app. Export `APP_ENV=production` before local EAS commands
  and trust the identity guard.
- **Sentry auth token missing locally**: sourcing `.env.local` alone does not
  export shell variables to Xcode. Use `pnpm build:prod:local`, which exports
  the file before starting EAS.
- **Expo Doctor says local module iOS/Android directories are ignored**: check
  `.easignore` as well as `.gitignore`; top-level generated directories need
  anchored `/ios` and `/android` rules so `modules/*/[ios|android]` is included.
- **Submit/update pnpm mismatch**: repair the affected workflow job's
  Corepack hook; do not relax pnpm workspace security policy.
- **`eas submit --id` mentions the dev bundle ID**: with a known artifact ID
  it is harmless, but always export `APP_ENV=production` to keep local config
  evaluation consistent.
