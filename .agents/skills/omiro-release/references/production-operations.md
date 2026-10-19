# Omiro release operations

## New Relic native build integration

The `newrelic-react-native-agent` Expo config plugin adds an Xcode Run Script phase that uploads JavaScript source maps and native dSYMs for symbolicated mobile error reports.

Set `EXPO_PUBLIC_NEWRELIC_IOS_APP_TOKEN` and `NEWRELIC_USER_API_KEY` in the
production EAS environment. The public app token starts the mobile agent and
uploads dSYMs; the sensitive user API key uploads source maps. The app token is
read by `services/observability.ts` and is not an ingest credential.

Use a sensitive EAS variable or local secret manager for the user API key so
the local build can upload source maps. `pnpm build:prod:local` loads and
exports `.eas-prod.local`, then verifies the production identity before
building. Confirm source maps and dSYMs appear in New Relic before relying on
production stack traces.

The root `ios/` entries in both `.gitignore` and `.easignore` must stay anchored (`/ios`). An unanchored `ios` entry also excludes `modules/*/ios` local Expo module source from EAS archives.

## Production verification

The release path is local:

```text
merge to main -> just mobile check -> build:prod:local -> submit:local -> TestFlight
```

TestFlight candidates and App Store releases use the same production bundle,
backend, and native binary. There is no separate staging binary. The marketing version is committed in app config and EAS remotely increments
only the iOS build number. The EAS cloud workflow
([`.eas/workflows/production-release.yml`](../../../apps/omiro/.eas/workflows/production-release.yml),
started by `deploy-mobile`) still exists but is not used: it builds on EAS,
which the maintainer does not pay for. `deploy-mobile.yml` is disabled and only
runs on manual dispatch.

Deliver every production change as a new TestFlight candidate, then approve
and release it through App Store Connect.

To release, run `pnpm build:prod:local`. It loads the gitignored `.eas-prod.local`, forces
`APP_ENV=production`, and writes `build/prod-local.ipa`. Upload that exact
artifact with `pnpm submit:local`; it re-checks the production identity and
passes the file explicitly to `eas submit`.

An IPA upload never publishes an OTA update. Ship JS-only fixes with `just mobile update "<message>"` ([`.eas/workflows/ota-update.yml`](../../../apps/omiro/.eas/workflows/ota-update.yml)) instead of a full store build. That starts the approval-gated EAS workflow and only reaches installs already running a native build with matching `runtimeVersion`; native dependency, permission, plugin, or other native changes require a new TestFlight build first.
