# Pre-Push Validation

Before reporting any change complete, and before opening a PR or pushing to main, run the full gate:

```bash
pnpm run check
pnpm format:check
```

`pnpm run check` runs `check:dts`, `tasks:check`, lint, build, typecheck, and test across all workspaces, with `DATABASE_URL` set (see the root `check` script in `package.json`). It does not run `format:check`, so run that separately. Failures you did not cause are still yours to fix.

If it fails, triage in this order:

1. **Typecheck errors** — fix type issues first; they often cascade into lint failures
2. **Lint errors** — `pnpm lint:fix` and `pnpm format` apply formatting and lint fixes
3. **Build errors** — check for missing exports or broken package references
4. **Test failures** — ensure the test DB is up and migrations are applied (`just db migrate test`)

While iterating, scope to one package and its dependents (never to skip a check):

```bash
pnpm lint --filter=@hominem/api...
pnpm typecheck --filter=@hominem/api...
pnpm build --filter=@hominem/api...
pnpm test --filter=@hominem/api...
pnpm format:check --filter=@hominem/api...
```

## Build order after changing a `services/api` route or schema

Rule: if the change also touches `apps/web` and/or `apps/omiro`, `@hominem/api` typechecking
clean is not enough — rebuild it before touching the frontend, in this order:

```bash
pnpm --filter @hominem/api build     # regenerates build/rpc/app.d.ts — required, not optional
pnpm --filter @hominem/rpc typecheck # or build, if packages/rpc/src/types/*.ts changed too
pnpm --filter @hominem/web typecheck   # only if apps/web actually consumes the change
pnpm --filter @hominem/omiro typecheck # only if apps/omiro actually consumes the change
```

Typecheck whichever app(s) actually changed, not both by default — an Omiro-only consumer doesn't
need `@hominem/web` validated, and vice versa.

Why: `packages/rpc`'s `HonoClient`/`AppType` (and anything derived via
`InferResponseType`/`InferRequestType`) resolve against the committed
`services/api/build/rpc/app.d.ts`, not live source. Skip the build and you get a "property doesn't
exist on client" error in frontend code that hasn't changed — the fix is never in the file the
error points at.

## Local pre-commit hooks

- `.githooks/pre-commit` — tracked, `core.hooksPath` points here, runs oxfmt on staged files.
- `.git/hooks/pre-commit` — untracked, machine-local, may run
  `react-doctor --staged --blocking warning` and abort the commit on any warning. If this blocks
  a commit, load the `react-doctor` skill.
- Before fixing a react-doctor finding, check it against `.oxlintrc.json` and existing merged
  code. react-doctor does not read `.oxlintrc.json` ("no supported framework detected" in its
  output means it fell back to a generic default ruleset) — a finding oxlint already accepts
  everywhere is a tool-mismatch false positive, not a regression. Use `--scope changed` to see
  only what the current change actually introduced.
