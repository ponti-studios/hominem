---
title: 'Career sub-app: applications pipeline'
status: 'Implemented'
priority: 'high'
labels: [web, career, migration]
depends_on: [web-subapp-career-collections]
blocks: []
estimated_size: 'L'
---

## Outcome

The application pipeline renders at `/career/applications`, including the list with filters, the
create/edit form, and the detail tabs (overview, timeline, notes, files, resume), over
`/api/career/applications/*`.

## Acceptance criteria

- [ ] List, new, and detail routes mount under `/career/applications`.
- [ ] Detail tabs read `stages` and `offers` from the existing detail endpoint; no per-tab loaders hit
      the database.
- [ ] Notes and file attach/detach use the RPC endpoints; upload uses the composed upload flow from
      [web-api-career-gaps.md](web-api-career-gaps.md).
- [ ] The resume tab calls the API customize endpoint.
- [ ] Filters, status badges, and stage display preserve current behavior.
- [ ] Tests cover list filtering, detail tabs, and one note/file mutation over MSW.
- [ ] No `@hominem/db` import exists in the migrated module.

## Evidence

`/career/applications` renders the filtered list, the create form, and the detail tabs. The RPC
create/update now materialise the matching pipeline stage. Browser evidence in `career.spec.ts`:
"creates an application and renders every detail tab". Notes and files use the RPC endpoints; uploads
go through `/api/career/documents` and attach with the file metadata.

