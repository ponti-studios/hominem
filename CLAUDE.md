# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo structure

pnpm monorepo orchestrated with Turbo. Key directories:

- `apps/omiro` — Expo/React Native iOS app (Apple-only; no Android fallbacks)
- `apps/career` — React Router v7 web app
- `services/api` — Hono HTTP + BullMQ worker
- `packages/db` — PostgreSQL + Kysely + Goose migrations
- `packages/auth` — Better-auth (passkeys + OTP)
- `packages/ai` — OpenRouter integration
- `justfiles/` — Just recipes (preferred over raw `pnpm` scripts)

## Commands

Prefer `just` recipes over bare `pnpm` commands.

```bash
just dev-api              # API in watch mode
just check-api            # lint + typecheck + test for API
just mobile-lint          # lint omiro
just run-ios dev          # launch omiro on iOS simulator
pnpm run precommit        # format + lint (run before committing)
pnpm run prepush          # full test suite
pnpm run check            # typecheck + lint + build + test (full validation)
```

## Database workflow

After any schema change, follow [.agents/skills/db-migrate/SKILL.md](.agents/skills/db-migrate/SKILL.md):

```bash
just db-migrate           # run Goose migrations + kysely-codegen
```

`packages/db/src/types/database.ts` is generated — never edit it by hand.

Tests require the **test database** (`DATABASE_URL_TEST`) with migrations applied:

```bash
just db-migrate           # applies to both local and test DB
```

Local DB: `postgresql://postgres:postgres@127.0.0.1:5434/app`  
Test DB: `postgresql://postgres:postgres@127.0.0.1:4433/app-test`

## Code style

- Linter: **oxlint** — `typescript/no-explicit-any` is an **error**, not a warning
- Formatter: **oxfmt** — single quotes, imports sorted ascending case-insensitively
- Run `pnpm run format` to apply formatting before any edit is considered done
- Follow YAGNI; use arrow-function shorthand (`() => fn(args)` not `() => { return fn(args); }`)

## Git conventions

- Branch naming: `feature/<name>`
- PR merge: squash commit
- Never commit on the user's behalf — always leave commits for the user to review and push

## Mobile (omiro)

- iOS-only — do not add Android platform checks or fallbacks
- Uses Expo managed workflow
- Maestro UI tests: always select by `testID` (`id:`), never by text — accessibility tree merging silently misses modals

## Monorepo notes

Each app/package can have its own `CLAUDE.md` for module-specific guidance. `.claude/rules/` files are loaded automatically alongside this file and can be scoped to specific paths.
