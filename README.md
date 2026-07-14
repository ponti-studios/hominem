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
2. `just dev api`
3. `just test api`

When you are working on the API or shared backend code, run the API validation lane instead:

1. Start the local test services you need.
2. Run `just check api`

For Omiro work, use the app bootstrap loop in `apps/omiro/README.md`:

1. `just mobile prebuild development`
2. `just mobile dev`

## Canonical Commands

- `just setup`: install dependencies and prepare the repo toolchain
- `just dev <scope>`: start a product development loop
- `just check <scope>`: read-only format, lint, typecheck, build, and test validation
- `just test <scope>`: run tests with the shared test database profile
- `just format write <scope>`: apply formatting
- `just db migrate [test]`: apply database migrations
- `just db codegen`: regenerate database types against the caller's `DATABASE_URL`
- `just mobile <action>`: iOS development, test, build, update, and release commands

## Setup And Build

1. `just setup`
2. `just check api`
3. `just build` for a full workspace build when needed

`just` is the only repo-level command interface. Package scripts are Turbo primitives.

## CI Model

The workflow is split into two layers:

- canonical checks: `Web Checks` and `API Checks`
- confidence lanes: `DB Migrations` and `E2E Web Auth`

The goal is to keep the product feedback loop focused while still preserving slower release-confidence checks.
