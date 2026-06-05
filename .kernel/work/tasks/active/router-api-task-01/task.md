---
id: router-api-task-01
type: task
title: Codify React Router route-response conventions and shared boundary cleanup
status: done
created_at: 2026-06-04
updated_at: 2026-06-04
goal: .kernel/work/goals/router-api-goal-01/goal.md
priority: medium
linked_knowledge:
  - .kernel/knowledge/notes/react-router-api-note-01/note.md
---

# Codify React Router route-response conventions and shared boundary cleanup

## summary

Before touching every route module, establish the exact repo convention for React Router API route returns and align the small set of shared route-boundary helpers/contracts to that convention. This task should make the later route refactors mechanical instead of opinion-based.

## context

- Latest React Router docs prefer plain object returns for ordinary route data and `data(...)` for status/header cases.
- The current codebase mixes raw JSON `Response` construction, local `jsonResponse(...)` wrappers, `Response.json(...)`, and plain object helpers.
- Route-facing contracts have already started moving toward dedicated boundary files in the career app; this refactor should continue that direction instead of reintroducing types into unrelated files.

## acceptance criteria

- [x] A clear route-module convention is applied consistently in code review notes / implementation: plain object for ordinary success, `data(...)` for status/header needs, raw `Response` only when justified.
- [x] Any shared helper that only wraps `new Response(JSON.stringify(...))` is either removed, replaced, or explicitly justified.
- [x] Route-facing request/response contracts for affected routes live in route-boundary modules rather than unrelated domain or utility files.
- [x] The implementation scope for each route is documented well enough that later tasks can execute without re-auditing the docs.

## steps

1. Import and use React Router `data` where route modules need explicit status/headers.
2. Identify helper wrappers in `apps/career` and `apps/web` that only exist to produce JSON `Response` objects.
3. Decide which helpers stay (if any) and which should be removed in later tasks.
4. Ensure route contracts for the affected endpoints are colocated at the route/API boundary.
5. Record any route that genuinely requires raw `Response` or throw semantics so the later tasks do not accidentally erase intended behavior.

## dependencies

- `.kernel/knowledge/notes/react-router-api-note-01/note.md`

## validation

- Review the affected route modules and verify each one fits one of the approved return patterns.
- Typecheck any shared helper or contract modules touched during this task.

## journal

- 2026-06-04: Created from the React Router API route audit and docs review.
- 2026-06-04: Completed task 01. Removed the web-only `jsonResponse` helper, switched `apps/web/app/routes/api/auth/google.ts` to plain object / `data(...)`, and recorded the approved route-return patterns and known carve-outs in the linked knowledge note.
