# AGENTS.md

- Aim for maximum runtime performance and zero duplication.
- Keep functions and files small and focused.
- Prefer Go over Python.
- Follow TDD.
- Do not add comments to code unless absolutely necessary.

## Runbook

- `pnpm --filter @hakumi/api run test` runs the API test suite.
- `pnpm --filter @hakumi/api run typecheck` runs API type checks.
- `pnpm --filter @hakumi/web run test` runs the web unit tests.
- `pnpm --filter @hakumi/web run typecheck` runs web type checks.
