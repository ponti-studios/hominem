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
- `justfile` and `just/*.just` — the repository command interface and its domain modules

## Commands

Use `just` for every repo-level command. Package scripts are internal Turbo primitives.

```bash
just dev api
just check api
just check mobile
just format write
just db migrate
```

## Database workflow

After any schema change, follow [.agents/skills/db-migrate/SKILL.md](.agents/skills/db-migrate/SKILL.md):

```bash
just db migrate            # apply migrations using DATABASE_URL
just db codegen            # regenerate Kysely types using DATABASE_URL
```

`packages/db/src/types/database.ts` is generated — never edit it by hand.

Tests require `DATABASE_URL` to point at the intended test database with migrations applied:

```bash
just db migrate test
```

Do not rely on fallback database URLs. Set `DATABASE_URL` explicitly for local dev, CI, and tests.

## Code style

- Linter: **oxlint** — `typescript/no-explicit-any` is an **error**, not a warning
- Formatter: **oxfmt** — single quotes, imports sorted ascending case-insensitively
- Run `just format write` to apply formatting before any edit is considered done
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
