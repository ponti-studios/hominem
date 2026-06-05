---
id: router-api-goal-01
type: goal
title: Standardize React Router API routes across career and web
status: done
created_at: 2026-06-04
updated_at: 2026-06-04
linked_knowledge:
  - .kernel/knowledge/notes/react-router-api-note-01/note.md
---

# Standardize React Router API routes across career and web

## summary

Refactor every React Router API-like route module in `apps/career` and `apps/web` to follow the current React Router `7.17.0` guidance: return plain objects for ordinary data, use `data(...)` when status or headers are required, remove unnecessary hand-built JSON `Response` wrappers, and keep route request/response contracts close to the route boundary.

## problem / opportunity

The current React Router API routes use a mixed set of response patterns: repeated `new Response(JSON.stringify(...))`, local `jsonResponse(...)` helpers, `Response.json(...)`, plain object helpers, and thrown text `Response` values. This inconsistency makes the route layer harder to read, increases the chance of drift between routes, and keeps the codebase out of step with current React Router guidance. A coordinated refactor now can make the route modules more idiomatic, easier to maintain, and easier to type consistently across both apps.

## success criteria

- Every API-like React Router route module in `apps/career` and `apps/web` follows one consistent response strategy.
- Ordinary successful route results return plain data objects unless status/headers require `data(...)`.
- Routes that need status codes and/or headers use `data(...)` instead of hand-built JSON `Response` objects.
- Unnecessary local JSON response wrappers are removed or reduced to truly necessary edge cases.
- Request/response contract types for these route modules live at the route/API boundary and are consumed consistently by callers.
- Existing client-visible payload shapes and auth/error semantics remain correct unless intentionally standardized with matching consumer updates.
- The affected apps typecheck cleanly and route-specific tests or regression checks pass.

## scope

- `apps/career/app/routes/api.applications.create.ts`
- `apps/career/app/routes/api.job.scrape.ts`
- `apps/career/app/routes/api.portfolio.$userId.ts`
- `apps/career/app/routes/api.resume.convert.ts`
- `apps/career/app/routes/api.resume.customize.ts`
- `apps/career/app/routes/api.validate-slug.ts`
- `apps/web/app/routes/api/auth/google.ts`
- Route-facing contract files and small supporting helpers used by those modules
- Route consumers in `apps/career` / `apps/web` when response contract imports need to move

## non-goals

- Refactoring Hono RPC routes under `services/api/src/rpc/**`
- Reworking unrelated business logic inside the route handlers
- Changing endpoint URLs or product behavior beyond response-shape/route-layer consistency
- Replacing every helper in `apps/career/app/lib/route-utils.ts` unless it is part of this route response cleanup

## task groups

### Conventions and shared boundary cleanup

- router-api-task-01: codify React Router response conventions and align shared route boundary helpers/contracts

### Career route refactor

- router-api-task-02: refactor career mutation-style API routes to plain object / `data(...)` returns
- router-api-task-03: refactor career read-style API routes and the web auth route to the same response model

### Verification

- router-api-task-04: validate route behavior, type safety, and contract consistency across career and web

## linked knowledge

- `.kernel/knowledge/notes/react-router-api-note-01/note.md`

## journal

- 2026-06-04: Goal created after auditing all React Router API route modules across `apps/career` and `apps/web` and confirming the latest React Router guidance for route-module JSON/data responses.
- 2026-06-04: Completed across tasks 01-04. All audited React Router API-like route modules in `apps/career` and `apps/web` now follow the repo convention of plain object success returns plus `data(...)` for explicit status/header cases, the legacy JSON response wrappers were removed where unnecessary, and both `@hominem/career` and `@hominem/web` typechecks pass. Focused automated validation for `api.resume.convert.ts` now also passes against `DATABASE_URL_TEST=postgresql://postgres:postgres@127.0.0.1:5434/app-test`.
