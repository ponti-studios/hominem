---
title: 'Close the career API gaps'
status: 'Implemented'
priority: 'high'
labels: [api, career, rpc]
depends_on: []
blocks: []
estimated_size: 'L'
---

## Outcome

Everything `apps/career` currently does inside its own React Router server — profile writes, the public
portfolio read, documents, resume AI flows, skills derivation/search, slug availability, and file
uploads — is available over `/api/career`, backed by `application/career.service.ts` and
`schemas/career.schema.ts`.

## Acceptance criteria

- [ ] `PATCH /api/career/profile` updates the caller's profile (service `updateCareerProfile`).
- [ ] `GET /api/career/portfolio/:slug` serves the public portfolio without auth, owner-scoped read.
- [ ] Documents used by the account surface are listed through the API (reuse `/api/files` where it is
      already equivalent).
- [ ] Resume convert, analyze, job-stream, and customize live in the API. The app-local duplicate
      pipeline (`routes/api.resume.*`, `lib/services/resume-conversion.service.ts`) is deleted in the
      same change; `workers/resume-analysis.ts` is the single implementation.
- [ ] `POST /api/career/skills/derive` and `GET /api/career/skills/search` replace the app routes.
- [ ] `GET /api/career/profile/slug-available` replaces `api.validate-slug`.
- [ ] Application file upload composes the `/api/files` upload flow with the existing
      `applications/:id/files/create` attach.
- [ ] Each endpoint has an integration test, and MCP adapters exist where the capability is
      agent-relevant.
- [ ] `apps/career` no longer imports `@hominem/db`, `@hominem/queues`, `@hominem/storage`, or
      `@hominem/ai` outside of a documented transitional exception.

## Notes

Sequence resume work last: it is the largest and it is the only part that changes a queue contract.
Settled decisions: domain routes are prefixed (`/career/*`), the public profile stays at `/p/:slug`,
account settings collapse into platform `/settings`. See
[web.sub-apps.md](../web.sub-apps.md#9-decisions).

## Evidence

Implemented and verified on 2026-11-05:

- `PATCH /api/career/profile`, `GET /api/career/profile/detail`, `GET /api/career/profile/slug-available`,
  `DELETE /api/career/profile`, `POST /api/career/profile/image` (multipart), and
  `POST /api/career/documents` / `DELETE /api/career/documents/:id`.
- `GET /api/career/portfolio/:slug` (public, `is_public` only) with positions, projects, and skills.
- `GET /api/career/skills/search` and `POST /api/career/skills/derive`, backed by
  `application/career-skills.service.ts` (moved out of the app).
- `POST /api/career/resume/{convert,analyze,import,customize}` and
  `GET /api/career/resume/jobs/:id/stream`, backed by `application/career-resume.service.ts`; the
  analysis worker in `workers/resume-analysis.ts` is the single implementation.
- Application creates and status updates now create the required pipeline stage before writing the
  status (`current_stage_id` is set), fixing the stage-less APPLIED/SCREENING/OFFER failure.

Evidence: `career.profile-portfolio.test.ts` (5 integration tests against the test database),
`career.resume.test.ts` (5 route tests), `career.skills.test.ts` (2 route tests), and the 17 browser
tests in `apps/web/tests/e2e/{career,finance}.spec.ts` (13 Career, 4 Finance). While porting, the
`requestBodyLimit` middleware was found 500ing every `DELETE` (Hono's `bodyLimit` cannot re-wrap the
Node request); `DELETE` is now treated as bodyless, covered by `body-limit.test.ts`, and collection
deletes work again. Removing the old app's duplicate server modules
is part of [web-deprecate-standalone-apps.md](web-deprecate-standalone-apps.md).

