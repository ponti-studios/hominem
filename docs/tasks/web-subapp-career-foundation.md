---
title: 'Career sub-app: profile and account foundation'
status: 'Implemented'
priority: 'high'
labels: [web, career, migration]
depends_on: [web-platform-shell, web-api-career-gaps]
blocks: []
estimated_size: 'M'
---

## Outcome

Career's identity surface — profile, social links, certifications, resume import entry point, and
documents — renders at `/career/profile` as a pure API client. Account settings live in platform
`/settings`.

## Acceptance criteria

- [ ] `/career/*` route layout exists with its own sub-navigation and the auth guard inherited from
      `_authenticated`.
- [ ] Profile view and edit call `GET`/`PATCH /api/career/profile`; social links and certifications use
      their existing endpoints.
- [ ] The resume import entry point calls the API flow from
      [web-api-career-gaps.md](web-api-career-gaps.md) and still produces the import diff.
- [ ] Documents render from the API listing.
- [ ] The old `/account` screen is not migrated; `/settings` is the only settings surface.
- [ ] No `@hominem/db` import exists anywhere in the migrated module.
- [ ] Tests cover profile load, save, and error states over MSW.

## Notes

This task unlocks every other Career task; finish it before touching collections or applications.

## Evidence

`/career` mounts under the platform shell with its own sub-navigation; profile, social links,
certifications, documents, image upload, resume import, and slug/visibility edits run through
`/api/career/*` only. The public profile renders at `/p/:slug` outside the authenticated layout.
Browser evidence: `apps/web/tests/e2e/career.spec.ts` ("profile renders the editable profile surface",
"the public portfolio renders logged out"). Unit evidence: 60 tests in `apps/web`.

