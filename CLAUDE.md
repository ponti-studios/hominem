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

## Expo and EAS

- Omiro enables Metro package exports. Shared ESM packages can contain explicit `.js` imports that point to TypeScript source files; Omiro's Metro resolver must retry those imports without `.js` so Metro can resolve them. Preserve Node ESM specifiers in shared packages.
- Corepack and EAS must not both install a pinned pnpm version. With `corepack: true`, omit the `pnpm` field from `apps/omiro/eas.json` to avoid EAS's `npm -g install pnpm` `EEXIST` failure.
- Validate Omiro bundling with `pnpm --filter @hominem/omiro exec expo export:embed --eager --platform ios --dev false`.

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

## Authentication and production incidents

- Better Auth owns OTP delivery, session creation, renewal, and logout. Do not add custom token or session storage when the Better Auth surface already exists.
- Production must set `AUTH_TEST_OTP_ENABLED=false`. The schema default may only enable test OTP behavior when `NODE_ENV === 'test'`; otherwise the API can return a successful OTP response while skipping Resend.
- Never rotate `BETTER_AUTH_SECRET` during an incident without confirming the impact. Better Auth signs session cookies with this secret, so a rotation can invalidate existing app and web sessions while database rows remain present.
- For Railway auth incidents, verify the deployed service and `/api/status`, inspect auth HTTP status patterns, confirm the production OTP flag, and query only aggregate session counts/expiry through `railway connect database --ssh`. Do not print or retrieve OTPs, tokens, cookies, credentials, or user records.
- `scripts/command` is a Bash command router invoked through `just`; use the `justfile` recipes as the public command interface.

## Adding a new package, app, or service

The repo is about to grow (more apps importing). Follow this checklist so new pieces don't silently reintroduce problems already fixed once:

**Never add a `workspace:*` dependency for a type-only import.** If you only `import type { X } from '@hominem/y'`, do not list `@hominem/y` in `package.json`. pnpm/turbo build their task graph from `package.json` edges with no idea an import is type-only — a single `import type` turned into a real dependency once dragged another package's entire build/test/lint/typecheck into every consumer's CI scope, which is why `@hominem/omiro` and `@hominem/career` needed a fake `BETTER_AUTH_SECRET` in CI for no functional reason. Instead, add a `paths` alias directly in your own `tsconfig.json` pointing at the real source file:

```json
"paths": { "@hominem/api/types": ["../../services/api/src/rpc/app.ts"] }
```

Keep it in sync with whatever `services/api/package.json`'s `exports` map says that subpath resolves to. `packages/rpc`, `apps/career`, `apps/omiro`, and `apps/finance` all do this for `@hominem/api` — copy the pattern.

**New library package (something other packages depend on at runtime):**

1. `tsconfig.json`: `rootDir: "src"`, `outDir: "./build"`, `tsBuildInfoFile: "./.cache/tsconfig.tsbuildinfo"` — always package-local, never a shared cross-package `.cache/` path. Turbo can't safely cache outputs that escape a package's own directory.
2. Add a `"references"` array mirroring your real `package.json` dependencies exactly (only other composite library packages — see below).
3. Add a `"build": "tsc -p tsconfig.json"` script if you don't have one — required for your `references` (and anything referencing _you_) to resolve real declaration output instead of erroring with "Output file has not been built from source file" during `tsc --noEmit`.
4. Register yourself in the root `tsconfig.json`'s `references` array — but only if `outDir` is actually set. A referenced project with no `outDir` and `tsc -b` run from root will ignore `noEmit` and write generated `.js`/`.d.ts` straight into your `src/` tree (this happened while wiring this up — `packages/rpc` and `services/api` are deliberately excluded from the root graph for exactly this reason, since they're type-inference boundary packages, see below).

**Package that infers types across other packages (Hono `typeof app` RPC pattern, like `services/api`):** do NOT wire it into the composite `references` graph even if its dependencies are composite. TS's "portable type" check (`TS2883`) refuses to infer an exported type like `AppType` across a real composite project boundary without an explicit annotation, which defeats Hono's RPC type-inference pattern. Keep it resolving dependencies via plain source (no `references`, `composite: false`), exactly like `services/api/tsconfig.json` and `packages/rpc/tsconfig.json` already do — their tsconfig comments explain why.

**New deployable app or service:**

1. `Dockerfile`, if it deploys via Railway/Docker: follow `services/api/Dockerfile` / `apps/career/Dockerfile` — `COPY` only `packages`, `services/api` (if you need its types), and your own app directory, never `COPY . .`, then `pnpm install --frozen-lockfile --filter @hominem/<name>...` (scoped install) before building. This keeps build time and context size flat as unrelated apps get added to the monorepo.
2. `.github/workflows/validate-<name>.yml`: model it on `validate-career.yml`. Set every env var your app _and its transitive dependencies_ actually require in the job's `env:` block with fake test values — including ones you don't obviously need yourself (e.g. `DATABASE_URL` if you depend on `@hominem/db`, `BETTER_AUTH_SECRET` if anything in your dependency chain imports `services/api` for real). Use `./.github/actions/setup-pnpm-workspace` for setup — it caches both the pnpm store and turbo's local cache directory (`.turbo/cache`), shared across all `validate-*.yml` workflows, so your new workflow reuses whatever core packages an earlier workflow already built/tested on this branch instead of rebuilding them from scratch. This is the main lever keeping CI time from growing linearly with app count — see "CI and build performance" below.
3. `deploy-<name>.yml`, if it deploys: trigger on `workflow_run: { workflows: [validate-<name>] }`. The workflow **name** (the `name:` field, not the filename) must match exactly — renaming a `validate-*.yml` workflow silently breaks its deploy trigger with no error.

## CI and build performance

- Real remote caching (Vercel Remote Cache or self-hosted) is not configured — every CI log shows "Remote caching disabled" even though `TURBO_TOKEN`/`TURBO_TEAM` are wired into every `validate-*.yml`. Until that's set up, `.github/actions/setup-pnpm-workspace/action.yml` caches turbo's local `.turbo/cache` directory via `actions/cache`, shared across all validate workflows on a branch — this is what stops every workflow from redundantly rebuilding the same core packages. Setting up real remote caching (needs a Vercel team/token or a self-hosted cache server) would let this same benefit extend across branches and to every contributor's local machine, and should replace this local-cache stand-in once available.
- `assumeChangesOnlyAffectDirectDependencies` is set in `tsconfig.base.json` for tsserver editor responsiveness in this project-reference graph (ignored by `tsc`/CI, editor-only). Anything that doesn't go through the shared `tsconfig.profiles/*` chain — like `apps/omiro`, which extends `expo/tsconfig.base` directly — needs the same flag set explicitly in its own `tsconfig.json`.
- `turbo.json`'s `typecheck` task `dependsOn: ["^build"]` — a package's composite dependencies get built (and turbo-cached) before it typechecks, so referenced projects have real declaration output to resolve against.

## Monorepo notes

Each app/package can have its own `CLAUDE.md` for module-specific guidance. `.claude/rules/` files are loaded automatically alongside this file and can be scoped to specific paths.
