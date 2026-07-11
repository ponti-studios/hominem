---
name: check-all
description: Run full pre-push validation — typecheck, lint, build, and test across the entire monorepo. Use before opening a PR or pushing to main.
disable-model-invocation: true
---

Run the full validation suite:

```bash
pnpm run check
```

This runs `turbo run typecheck lint build test --concurrency 1 --force` across all workspaces.

If it fails, triage in this order:
1. **Typecheck errors** — fix type issues first; they often cascade into lint failures
2. **Lint errors** — `pnpm run precommit` applies formatting and lint fixes
3. **Build errors** — check for missing exports or broken package references
4. **Test failures** — ensure the test DB is up and migrations are applied (`just db-migrate`)

For a faster per-package check on the API only:
```bash
just check-api
```
