---
id: react-router-api-note-01
type: note
title: React Router API route response guidance and route inventory
status: active
created_at: 2026-06-04
updated_at: 2026-06-04
linked_work:
  - .kernel/work/goals/router-api-goal-01/goal.md
---

# React Router API route response guidance and route inventory

## summary

React Router `7.17.0` route-module documentation shows that route `loader` and `action` functions should return plain data objects for ordinary JSON/data results, and use `data(...)` when status codes and/or headers are required. The docs explicitly position `data(...)` as the replacement for hand-constructing JSON `Response` objects in routine route-module work.

## documentation findings

- Route module docs show `loader` and `action` returning plain objects directly.
- The `data(...)` utility is documented as the way to attach `status` / `headers` without building a raw `Response`.
- This means `new Response(JSON.stringify(...), ...)` is not the preferred pattern for ordinary React Router API route modules.

## recommended repo convention

- Return plain objects for successful route data when no special HTTP metadata is needed.
- Return `data(payload, { status, headers })` when a route must attach status or headers.
- Reserve raw `Response` construction for cases where React Router data helpers are genuinely insufficient.
- For API-like route modules, prefer JSON-shaped error payloads over thrown text `Response` values unless route-boundary rendering specifically requires throw semantics.
- Keep request/response contract types close to the route boundary, not in unrelated domain or utility packages.

## task-01 decisions

### Approved route return patterns

- **Plain object return** for ordinary success payloads.
- **`data(...)`** for payloads that must carry explicit `status` and/or `headers`.
- **Raw `Response` / thrown `Response`** only when a route has a real requirement that cannot be expressed cleanly with plain object returns or `data(...)`.

### Shared helper disposition

- **Keep** `apps/career/app/lib/route-utils.ts` `createErrorResponse` / `createSuccessResponse` because they return plain objects and already match the chosen route-data shape.
- **Remove** `apps/web/app/lib/utils.ts` `jsonResponse` because it only wrapped `new Response(JSON.stringify(...))` for one route and obscured the React Router-native return model.
- **Removed in task 02** `apps/career/app/routes/api.resume.convert.ts` local `jsonResponse(...)`; the route now uses plain object success returns and `data(...)` for non-200 statuses and rate-limit headers.

### Known carve-outs to preserve deliberately

- `apps/career/app/routes/api.resume.convert.ts` intentionally uses `data(...)` for non-200 statuses and rate-limit headers because HTTP metadata matters there.
- `apps/career/app/routes/api.portfolio.$userId.ts` was converted in task 03 to JSON-shaped `data({ error })` failures for 400/404/500 and a plain object success return, so API callers no longer depend on thrown text responses.

## current route inventory

### `apps/career`

1. `app/routes/api.applications.create.ts`
   - Now returns a plain object for success and `data(...)` for auth, validation, and server errors.
2. `app/routes/api.job.scrape.ts`
   - Now returns a plain object for success and `data(...)` for auth, validation, scrape-failure, and server-error cases.
3. `app/routes/api.portfolio.$userId.ts`
   - Now returns a plain portfolio object on success and `data({ error })` for 400/404/500 failures.
4. `app/routes/api.resume.convert.ts`
   - Now returns a plain object for success and `data(...)` for all error/status/header-sensitive outcomes.
5. `app/routes/api.resume.customize.ts`
   - Now returns a plain object for success and `data(...)` for validation, scrape failure, not-found, and server-error cases.
6. `app/routes/api.validate-slug.ts`
   - Keeps its plain-object success helper and now uses `data(...)` for invalid-input and server-failure statuses.

### `apps/web`

1. `app/routes/api/auth/google.ts`
   - Now uses `data(...)` for the explicit 401 case and a plain object return for ordinary success.

## important constraints for the refactor

- Preserve existing response body shapes unless a route contract is intentionally standardized and all consumers are updated together.
- Preserve auth and validation semantics.
- Be explicit about which routes should return JSON payloads versus throw route errors.
- Avoid mixing Hono RPC patterns with React Router route-module patterns; they are separate surfaces.

## linked work

- `.kernel/work/goals/router-api-goal-01/goal.md`

## journal

- 2026-06-04: Created after reviewing the latest React Router docs and auditing all current API-like route modules in `apps/career` and `apps/web`.
- 2026-06-04: Task 01 decisions recorded. Removed the web-only `jsonResponse` wrapper and confirmed the repo convention: plain object for ordinary success, `data(...)` for status/header cases, raw `Response` only by exception.
- 2026-06-04: Tasks 02 and 03 completed. Career mutation and read-style routes now follow the same plain object / `data(...)` model, with `api.resume.convert.ts` preserving rate-limit headers via `data(...)` and `api.portfolio.$userId.ts` deliberately converted away from thrown text responses.
- 2026-06-04: Validation status after tasks 02 and 03: `pnpm --filter "@hominem/career" typecheck` passes. `pnpm --filter "@hominem/web" typecheck` is still blocked by pre-existing `@hominem/ui` export errors in the notes components, and the focused `api.resume.convert` Vitest run is blocked in this session because `DATABASE_URL_TEST` is unset.
- 2026-06-04: Additional task-04 validation confirmed the web auth route itself still typechecks in isolation from `apps/web`, and the resume convert test suite requires a reachable Postgres instance at `DATABASE_URL_TEST` to progress past global Vitest DB setup. Setting a conventional local URL reached the suite and failed with `ECONNREFUSED 127.0.0.1:5432`, so the remaining test blocker is infrastructure availability rather than a route-response regression.
- 2026-06-04: Final task-04 validation used the already-running monorepo test database at `postgresql://postgres:postgres@127.0.0.1:5434/app-test`. After updating the `api.resume.convert` test helper to normalize React Router plain object and `DataWithResponseInit` returns, the focused Vitest suite passed (`22/22`).
