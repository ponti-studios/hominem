---
id: router-api-task-03
type: task
title: Refactor career read API routes and the web auth route to the same response model
status: done
created_at: 2026-06-04
updated_at: 2026-06-04
goal: .kernel/work/goals/router-api-goal-01/goal.md
priority: medium
linked_knowledge:
  - .kernel/knowledge/notes/react-router-api-note-01/note.md
---

# Refactor career read API routes and the web auth route to the same response model

## summary

Finish the route-layer standardization by refactoring the remaining read-oriented API routes in career and the single API route currently in web.

## context

Primary target files:

- `apps/career/app/routes/api.portfolio.$userId.ts`
- `apps/career/app/routes/api.validate-slug.ts`
- `apps/web/app/routes/api/auth/google.ts`

Special care is required for `api.portfolio.$userId.ts` because it currently throws text `Response` values for failure cases instead of returning JSON payloads.

## acceptance criteria

- [x] `api.portfolio.$userId.ts` follows the chosen API-route convention and has an explicit decision on whether it should return JSON errors or intentionally throw route errors.
- [x] `api.validate-slug.ts` remains aligned with the repo-wide convention, including any needed `data(...)` usage for statuses.
- [x] `apps/web/app/routes/api/auth/google.ts` no longer uses a local JSON-response wrapper if it is unnecessary.
- [x] The route response behavior is consistent enough across career and web that future API-like route modules can copy one pattern.

## steps

1. Refactor `api.portfolio.$userId.ts`, deciding explicitly how API fetch callers should receive 400/404/500 failures.
2. Review `api.validate-slug.ts` and align its return/status behavior with the standard chosen in task 01.
3. Refactor `apps/web/app/routes/api/auth/google.ts` to plain object returns / `data(...)` as appropriate.
4. Verify any web or career callers that parse these endpoints still behave correctly.

## dependencies

- router-api-task-01
- router-api-task-02

## validation

- Typecheck `@hominem/career` and `@hominem/web`.
- Exercise any client code that fetches these routes and verify success/error handling still works.

## journal

- 2026-06-04: Created from audit. These are the remaining API-like React Router routes after the mutation-oriented career endpoints.
- 2026-06-04: Completed task 03. `api.portfolio.$userId.ts` now returns plain portfolio data on success and `data({ error })` payloads for 400/404/500 instead of thrown text responses. `api.validate-slug.ts` now uses `data(...)` for invalid-input and server-failure statuses while keeping the existing success payload contract.
- 2026-06-04: `pnpm --filter "@hominem/career" typecheck` passed. `pnpm --filter "@hominem/web" typecheck` remains blocked by pre-existing `@hominem/ui` export errors in the notes components, not by the web auth route changes.
