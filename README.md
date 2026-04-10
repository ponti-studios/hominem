# Hominem

Hominem is a product monorepo with three active surfaces:

- web in `apps/web`
- api in `services/api`
- mobile in `apps/mobile`

## Architecture

```text
apps/web       -> web UI, routes, browser-only helpers
apps/mobile    -> Expo app, native UI, mobile-only helpers
services/api   -> Hono API, auth, data access, workers
packages/core  -> shared config, db, env, utils
packages/platform -> shared hooks, UI, auth, rpc, telemetry, queues
```

The default direction is from apps into shared packages, and from shared packages into `services/api` only when backend coordination is required.

## Golden Path

Use the smallest possible loop by default.

1. `just setup`
2. `just dev-web`
3. `just check-web`

When you are working on the API or shared backend code, run the API validation lane instead:

1. Start the local test services you need.
2. Run `just check-api`

## Canonical Commands

- `just setup`: install dependencies and prepare the repo toolchain
- `just dev-web`: run the API and web apps for product work
- `just check-web`: lint, typecheck, test, and build the web app
- `just check-api`: lint, typecheck, and test the API
- `just web-e2e`: run the web browser suite
- `just db-migrations-validate`: validate migration idempotency

## Setup And Build

1. `just setup`
2. `just check-web` or `just check-api`
3. `pnpm turbo build` for a full workspace build when needed

## CI Model

The workflow is split into two layers:

- canonical checks: `Web Checks` and `API Checks`
- confidence lanes: `DB Migrations` and `E2E Web Auth`

The goal is to keep the product feedback loop focused while still preserving slower release-confidence checks.
