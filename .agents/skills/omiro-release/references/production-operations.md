# Omiro release operations

## Sentry native build integration

The `@sentry/react-native` Expo config plugin adds two Xcode Run Script phases: one uploads JavaScript sourcemaps during Metro bundling and one uploads native dSYMs after linking. With `@sentry/react-native@8.x`, both scripts resolve the nested `@sentry/cli` correctly under pnpm isolation and warn instead of aborting if resolution fails.

Set `SENTRY_ORG` and `SENTRY_PROJECT` in `eas.json`'s `build.base.env`,
`SENTRY_AUTH_TOKEN` as an EAS secret in the production environment, and
`EXPO_PUBLIC_SENTRY_DSN` as an EAS production variable. The DSN is read
directly by `services/observability.ts`. `SENTRY_DISABLE_AUTO_UPLOAD` is not
part of the current build environment.

EAS Secret variables never leave EAS servers, so a local EAS build cannot
retrieve `SENTRY_AUTH_TOKEN` from EAS. Store it only in the gitignored
`apps/omiro/.eas-prod.local`; `pnpm build:prod:local` loads and exports that
file for Xcode, then verifies the production identity before building. Do not
set `SENTRY_DISABLE_AUTO_UPLOAD` or `SENTRY_ALLOW_FAILURE` for a TestFlight
candidate: its source maps and dSYMs must upload.

The root `ios/` entries in both `.gitignore` and `.easignore` must stay anchored (`/ios`). An unanchored `ios` entry also excludes `modules/*/ios` local Expo module source from EAS archives.

## Production verification

The release path is:

```text
merge to main -> validate-mobile -> deploy-mobile -> EAS approval -> build -> TestFlight
```

TestFlight candidates and App Store releases use the same production bundle,
backend, and native binary. There is no separate staging binary. A successful
`validate-mobile` run on `main` triggers `deploy-mobile`, which starts
[`.eas/workflows/production-release.yml`](../../../apps/omiro/.eas/workflows/production-release.yml).
The workflow waits for approval, builds, verifies that the result is
`com.pontistudios.hakumi` with store distribution, and submits it to
TestFlight. The marketing version is committed in app config and EAS remotely
increments only the iOS build number.

Deliver every production change as a new TestFlight candidate, then approve
and release it through App Store Connect. If the GitHub-to-EAS trigger fails,
rerun the validated SHA from GitHub or the EAS dashboard rather than starting
an ad hoc release from a developer checkout.

For an explicitly requested local signed artifact, run
`pnpm build:prod:local`. It loads the gitignored `.eas-prod.local`, forces
`APP_ENV=production`, and writes `build/prod-local.ipa`. Upload that exact
artifact with `pnpm submit:local`; it re-checks the production identity and
passes the file explicitly to `eas submit`.

An IPA upload never publishes an OTA update. Ship JS-only fixes with `just mobile update "<message>"` ([`.eas/workflows/ota-update.yml`](../../../apps/omiro/.eas/workflows/ota-update.yml)) instead of a full store build. That starts the approval-gated EAS workflow and only reaches installs already running a native build with matching `runtimeVersion`; native dependency, permission, plugin, or other native changes require a new TestFlight build first.
