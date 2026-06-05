---
id: router-api-task-04
type: task
title: Validate React Router API route behavior and capture any remaining follow-ups
status: done
created_at: 2026-06-04
updated_at: 2026-06-04
goal: .kernel/work/goals/router-api-goal-01/goal.md
priority: medium
linked_knowledge:
  - .kernel/knowledge/notes/react-router-api-note-01/note.md
---

# Validate React Router API route behavior and capture any remaining follow-ups

## summary

After the route refactors land, run focused validation to prove that response bodies, statuses, headers, and consumer expectations still hold. Capture any follow-up work that falls outside the response-standardization scope.

## context

The refactor is mostly structural, but API-like route modules are sensitive because small changes in status handling, thrown errors, or JSON payloads can break fetch callers or form flows without obvious compile-time failures.

## acceptance criteria

- [x] Relevant career and web typechecks pass.
- [x] Existing route/component tests that cover the refactored endpoints pass, or any missing coverage is called out clearly.
- [x] Critical response details (status codes, headers such as rate-limit headers, JSON payload shape) are verified for the affected routes.
- [x] Any leftover cleanup or standardization opportunities are captured as explicit follow-up work rather than hidden in chat.

## steps

1. Run focused typechecks for `@hominem/career` and `@hominem/web`.
2. Run any route/component tests that cover resume upload, job scrape, resume customization, slug validation, portfolio fetch, and web auth route behavior.
3. Spot-check routes that attach headers or depend on non-200 statuses.
4. Record any remaining issues, edge cases, or helper cleanup as follow-up work if they are out of scope for this goal.

## dependencies

- router-api-task-02
- router-api-task-03

## validation

- `pnpm --filter "@hominem/career" typecheck`
- `pnpm --filter "@hominem/web" typecheck`
- Additional focused tests for refactored route consumers

## journal

- 2026-06-04: Created as the validation and closeout task for the React Router API route refactor goal.
- 2026-06-04: Validation pass results:
  - `pnpm --filter "@hominem/career" typecheck` passed after tasks 02 and 03.
  - `pnpm --filter "@hominem/web" typecheck` now passes after exporting `Button` and the `AlertDialog` primitives from `packages/platform/ui/src/index.ts`.
  - Focused file-scoped TypeScript validation for `apps/web/app/routes/api/auth/google.ts` passed from `apps/web`.
  - `DATABASE_URL_TEST=postgresql://postgres:postgres@127.0.0.1:5434/app-test pnpm --filter "@hominem/career" exec vitest run app/routes/api.resume.convert.test.ts` passes after updating the test helper to normalize React Router plain object / `data(...)` route returns into `Response` objects for assertions.
- 2026-06-04: Critical response behavior spot-checks:
  - `api.resume.convert.ts` still returns rate-limit headers through `data(...)` and keeps non-200 status handling at the route boundary.
  - `api.auth.google.ts` passes a focused TypeScript check with the plain object success return and `data(...)` 401 response.
  - Career route consumers continue to read JSON payloads via `response.json()` and were not updated because the payload body shapes were preserved.
- 2026-06-04: Coverage note: the repo currently has route-level automated coverage for `api.resume.convert.ts`. The other refactored route modules are covered here by package typechecks and manual contract preservation rather than dedicated route tests.
