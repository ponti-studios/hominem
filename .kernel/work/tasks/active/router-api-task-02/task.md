---
id: router-api-task-02
type: task
title: Refactor career mutation-style API routes to idiomatic React Router returns
status: done
created_at: 2026-06-04
updated_at: 2026-06-04
goal: .kernel/work/goals/router-api-goal-01/goal.md
priority: high
linked_knowledge:
  - .kernel/knowledge/notes/react-router-api-note-01/note.md
---

# Refactor career mutation-style API routes to idiomatic React Router returns

## summary

Refactor the career API routes that behave like mutation endpoints so they stop hand-building JSON `Response` objects and instead use plain object returns and `data(...)` where status/headers matter.

## context

Primary target files:

- `apps/career/app/routes/api.applications.create.ts`
- `apps/career/app/routes/api.job.scrape.ts`
- `apps/career/app/routes/api.resume.convert.ts`
- `apps/career/app/routes/api.resume.customize.ts`

These routes currently contain the highest concentration of repeated `new Response(JSON.stringify(...))` patterns and local JSON response wrappers.

## acceptance criteria

- [x] `api.applications.create.ts` no longer hand-builds JSON `Response` objects for ordinary JSON results.
- [x] `api.job.scrape.ts` uses idiomatic React Router returns and preserves current auth, validation, and error semantics.
- [x] `api.resume.convert.ts` no longer relies on a local helper whose sole job is to construct JSON `Response` objects, unless a specific edge case requires it.
- [x] `api.resume.customize.ts` uses the same return model and preserves its current payload contract.
- [x] Existing career UI consumers continue to receive the same effective payload fields unless intentionally standardized together.

## steps

1. Refactor `api.applications.create.ts` to use plain object returns / `data(...)`.
2. Refactor `api.job.scrape.ts` similarly, keeping its typed request/response contracts intact.
3. Refactor `api.resume.convert.ts`, paying special attention to status codes and any rate-limit headers.
4. Refactor `api.resume.customize.ts` and keep its contract module aligned with the route return shape.
5. Update any nearby consumers if imports or typing assumptions change.

## dependencies

- router-api-task-01

## validation

- Typecheck `@hominem/career`.
- Run existing route/component tests covering resume upload, job scrape, and customization flows if available.
- Manually inspect that `status` / headers are still attached where required.

## journal

- 2026-06-04: Created from audit. These routes account for most of the current JSON-response inconsistency in the career app.
- 2026-06-04: Completed task 02. Refactored the four mutation-style career routes to plain object success returns and `data(...)` for explicit statuses/headers, including rate-limit headers on resume conversion. `pnpm --filter "@hominem/career" typecheck` passed after the refactor.
- 2026-06-04: Existing focused `api.resume.convert` route test could not be re-run in this session because `DATABASE_URL_TEST` is unset in `apps/career/vitest.config.ts`; carry that environment-backed validation into task 04.
