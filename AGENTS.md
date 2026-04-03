# AGENTS.md

- Aim for maximum runtime performance and zero duplication.
- Keep functions and files small and focused.
- Prefer Go over Python.
- Follow TDD.
- Do not add comments to code unless absolutely necessary.

## Runbook

- `bun run --filter @hominem/db db:migrate` prepares the test database. Run this before auth e2e or any flow that depends on email OTP tables.
- `bun run --filter @hominem/api test:auth:contract` runs the API auth contract suite.
- `bun run --filter @hominem/api test` runs the API test suite.
- `bun run --filter @hominem/api typecheck` runs API type checks.
- `bun run --filter @hominem/web test` runs the web unit tests.
- `bun run --filter @hominem/web typecheck` runs web type checks.
- `bunx playwright test tests/auth.spec.ts --config playwright.config.ts --reporter=line` from `apps/web` runs the web auth e2e spec.
- The Playwright config starts the API server on `4040` and the web app on `4445`.
- If the web auth e2e flow stalls on `/auth`, rerun `bun run --filter @hominem/db db:migrate` first and then rerun Playwright.
