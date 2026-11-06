---
title: 'Career sub-app: work, projects, skills, testimonials'
status: 'Implemented'
priority: 'medium'
labels: [web, career, migration]
depends_on: [web-subapp-career-foundation]
blocks: []
estimated_size: 'M'
---

## Outcome

Career's collection surfaces render at `/career/work`, `/career/projects`, `/career/skills`, and
`/career/testimonials`, including list, create, and detail views, over the existing career CRUD
endpoints.

## Acceptance criteria

- [ ] List, new, and detail routes for all four collections mount under `/career/*`.
- [ ] Editors use the existing RPC endpoints; no page imports `@hominem/db`.
- [ ] Shared list/detail components live under `apps/web/app/modules/career`.
- [ ] Empty, loading, and error states match the previous app.
- [ ] Tests cover one list and one editor per collection over MSW.
- [ ] Links from the profile surface resolve to the new paths.

## Notes

`career-options.ts` and the pure formatting utilities can move unchanged; they have no server
dependency.

## Evidence

`/career/work`, `/career/projects`, `/career/skills`, and `/career/testimonials` render list, create,
and detail views over the RPC endpoints. Browser evidence in `career.spec.ts`: "creates a work
engagement and opens its detail page", "creates a project and lists it", "adds a skill through the
dialog", "adds a testimonial".

