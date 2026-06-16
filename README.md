# Hominem

Hominem is a product monorepo with two active surfaces:

- api in `services/api`
- omiro in `apps/omiro`

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

1. `just mobile-prebuild`
2. `just run-ios dev`

## Canonical Commands

- `just setup`: install dependencies and prepare the repo toolchain
- `just dev-api`: run the API for backend product work
- `just check-api`: lint, typecheck, and test the API
- `just validate-migrations`: validate migration idempotency

## Setup And Build

1. `just setup`
2. `just check-api`
3. `pnpm turbo build` for a full workspace build when needed

## CI Model

The workflow is split into two layers:

- canonical checks: `Web Checks` and `API Checks`
- confidence lanes: `DB Migrations` and `E2E Web Auth`

The goal is to keep the product feedback loop focused while still preserving slower release-confidence checks.
