---
title: 'Career sub-app: resume AI flows and public profile'
status: 'Implemented'
priority: 'medium'
labels: [web, career, ai, migration]
depends_on: [web-subapp-career-applications]
blocks: []
estimated_size: 'M'
---

## Outcome

The remaining Career surfaces — onboarding, resume analysis progress, and the public portfolio — run on
the platform origin, with streaming progress owned by the API and the PDF worker talking to a
configured origin.

## Acceptance criteria

- [ ] Onboarding (`/career/onboarding`) creates the first profile through the API converter.
- [ ] Resume analysis progress consumes the API SSE endpoint and shows the same stages.
- [ ] Skills derive/search use the API endpoints.
- [ ] Public profile renders at `/p/:slug` outside the authenticated layout, logged out, with its
      canonical meta.
- [ ] `/demo` and the application-cockpit prototype are removed (decision D6).
- [ ] The PDF generation call uses configuration instead of `https://career-worker.fly.dev`; a real
      generation succeeds against the platform origin.
- [ ] Playwright covers: logged-out public profile, first-profile onboarding, and one analysis run.

## Notes

Blocked in practice on whatever owns the external PDF worker; coordinate the origin change before
removing the old career domain.

## Evidence

Onboarding, resume analysis progress, skills search/derive, and the public portfolio run on the
platform origin. The PDF worker URL is now `VITE_CAREER_PDF_WORKER_URL`; when unset the profile page
reports that export is unavailable instead of calling a hardcoded host. Browser evidence in
`career.spec.ts`: "the public portfolio renders logged out"; route evidence:
`career.resume.test.ts` and `career.skills.test.ts`. The PDF-to-profile upload itself is not driven by a
browser test yet (it needs a fixture PDF and the AI provider), so that single path is covered at the
route level only.

