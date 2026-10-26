---
name: omiro-release
description: Omiro's shipping adapter for the studio-wide ship-ios flow. Use when releasing Omiro to TestFlight or App Store Connect, or shipping a JS-only OTA. Lifecycle, authorization, and reporting live in ship-ios; this skill holds only what is Omiro-specific: identity, env, OTA, and troubleshooting.
---

# Omiro release (ship-ios adapter)

Omiro ships through the studio pipeline: `just testflight` from the hominem
root runs `scripts/ship-omiro.sh` (the worked `ship_build` / `ship_upload`
example), a local IPA then App Store Connect, with no EAS cloud build. The
branch-to-TestFlight lifecycle — authorization, PR discipline, merge rules,
reporting — is the `ship-ios` skill; follow it. This file is only the Omiro
particulars.

## Commands

- Ship: `just testflight` from the hominem root (`--no-upload` dry run,
  `--skip-checks`, `--allow-branch`).
- OTA (JS-only): `just mobile update "<message>"` — starts the
  approval-gated EAS workflow on the production branch. Reaches only installs
  on a matching runtime version. Native changes always need a new binary.
- Manual two-step fallback (same steps the script runs): `pnpm eas:pull:prod`,
  `pnpm build:prod:local`, pause and confirm, `pnpm submit:local`.

## Omiro specifics

- Identity: `APP_ENV=production`, bundle `com.pontistudios.hakumi`, verified
  by `scripts/verify-release-identity.mjs` before build and re-checked at
  submit. A wrong identity is a hard stop — never bypass the guard. `export
  APP_ENV=production` before any local `eas` production command: ambient
  `.env.*.local` files can silently select the dev app.
- Environment: `eas:pull:prod` refreshes the gitignored `.eas-prod.local`
  (plain + sensitive production variables). Keep `NEWRELIC_USER_API_KEY` in a
  sensitive EAS variable or local secret manager — never printed or committed.
  `EXPO_PUBLIC_NEWRELIC_IOS_APP_TOKEN` is the embedded mobile token; the build
  plugin uses it to upload dSYMs.
- Build numbers: the marketing version is committed in `app.config.js`; EAS
  owns the iOS build-number increment. `apps/omiro/ios` is CNG-generated —
  never edit it; change config/plugins and regenerate.
- EAS cloud is not used: `deploy-mobile.yml` is disabled (manual dispatch
  only) and the cloud release path runs only when asked for by name. OTA
  updates run on EAS Update and are unaffected — they are cheap and stay.
- For New Relic integration, production verification, and the full
  operations reference, read
  [references/production-operations.md](references/production-operations.md).

## Troubleshooting

- **`expo doctor` fails** on patch-level package mismatches: the build still
  completes. Dependency cleanup, not a blocker, unless it is a native module
  you changed.
- **Wrong identity / `-19000`**: an ambient `.env.*.local` selected the dev
  app. Export `APP_ENV=production` and trust the guard.
- **New Relic token missing locally**: `pnpm eas:pull:prod`, then rebuild.
  The local wrapper checks both values before building.
- **Local module `ios`/`android` dirs ignored**: check `.easignore` as well as
  `.gitignore`; top-level generated dirs need anchored `/ios` and `/android`
  rules so `modules/*/[ios|android]` is included.
- **Submit/update pnpm mismatch**: repair the affected workflow job's Corepack
  hook; never loosen workspace supply-chain settings.
- **`eas submit --id` mentions the dev bundle ID**: harmless with a known
  artifact ID, but keep `APP_ENV=production` exported.
