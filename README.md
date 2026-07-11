# Hominem

Hominem is a product monorepo with two active surfaces:

- api in `services/api`
- omiro in `apps/omiro`

The reusable mobile starter extracted from Omiro now lives in the standalone
`/Users/charlesponti/Developer/ponti-mobile-starter` repo. Hominem continues to own the
production Omiro app, while `ponti-mobile-starter` owns the reusable mobile shell,
theming, auth seams, and starter contract for future experiments.

## Architecture

```text
apps/omiro     -> Expo app, native UI, mobile-only helpers
services/api   -> Hono API, auth, data access, workers
packages/*     -> shared libraries: db, env, utils, ui, auth, rpc, telemetry, hooks, etc.
```

The default direction is from apps into shared packages, and from shared packages into `services/api` only when backend coordination is required.

## Golden Path

Use the smallest possible loop by default.

1. `just setup`
2. `just dev-api`
3. `just check-api`

When you are working on the API or shared backend code, run the API validation lane instead:

1. Start the local test services you need.
2. Run `just check-api`

For Omiro work, use the app bootstrap loop in `apps/omiro/README.md`:

1. `just mobile-prebuild-development`
2. `just mobile-dev`

## Canonical Commands

- `just setup`: install dependencies and prepare the repo toolchain
- `just dev`: run the default multi-package development graph through Turbo
- `just dev-api`: run the API for backend product work
- `just dev-career`: run the career web app development graph
- `just dev-finance`: run the finance web app development graph
- `just dev-omiro`: run the Omiro iOS app development flow
- `just check-api`: lint, typecheck, and test the API
- `just check`: run the full workspace format, lint, build, and test lane
- `just mobile-prebuild-development`: prebuild the iOS app for development
- `just mobile-prebuild-production`: prebuild the iOS app for production
- `just mobile-dev`: build and run the Omiro iOS app
- `just start-ios`: start the Expo iOS flow without running `expo run:ios`
- `just validate-migrations`: validate migration idempotency

## Setup And Build

1. `just setup`
2. `just check-api`
3. `just build` for a full workspace build when needed

The root `package.json` scripts are convenience wrappers over these `just` recipes.
Prefer `just` directly when working in the repo so the toolchain always runs through `mise`.

## CI Model

The workflow is split into two layers:

- canonical checks: `Web Checks` and `API Checks`
- confidence lanes: `DB Migrations` and `E2E Web Auth`

The goal is to keep the product feedback loop focused while still preserving slower release-confidence checks.
