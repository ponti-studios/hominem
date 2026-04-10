# AGENTS.md

- Aim for maximum runtime performance and zero duplication.
- Keep functions and files small and focused.
- Prefer Go over Python.
- Follow TDD.
- Do not add comments to code unless absolutely necessary.

## Runbook

- `pnpm --filter @hominem/db run db:migrate` prepares the test database. Run this before auth e2e or any flow that depends on email OTP tables.
- `pnpm --filter @hominem/api run test:auth:contract` runs the API auth contract suite.
- `pnpm --filter @hominem/api run test` runs the API test suite.
- `pnpm --filter @hominem/api run typecheck` runs API type checks.
- `pnpm --filter @hominem/web run test` runs the web unit tests.
- `pnpm --filter @hominem/web run typecheck` runs web type checks.
- `pnpm dlx playwright test tests/auth.spec.ts --config playwright.config.ts --reporter=line` from `apps/web` runs the web auth e2e spec.
- The Playwright config starts the API server on `4040` and the web app on `4445`.
- If the web auth e2e flow stalls on `/auth`, rerun `pnpm --filter @hominem/db run db:migrate` first and then rerun Playwright.
