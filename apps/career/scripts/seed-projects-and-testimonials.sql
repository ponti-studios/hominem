-- Seeds the Projects and Testimonials sections of Charles Ponti's portfolio
-- (charles-ponti, is_public) for investor/demo screenshots of the gallery.
--
-- Projects are real: descriptions and tech stacks are pulled from the actual
-- labs/hominem monorepo apps (Craftd, RealiTea, Earth, Health, Commune,
-- Foundation), with start dates matching real first-commit dates where a
-- local repo was available to check.
--
-- Testimonials are illustrative placeholders for demo purposes, not real
-- client quotes: attribution uses generic first-name-plus-initial handles
-- (not specific real individuals) alongside real, recognizable company
-- names for authenticity of feel. All are marked is_verified = false since
-- they are not actual verified submissions.
--
-- Safe to re-run: guarded by "insert only if this portfolio has none yet".

BEGIN;

-- Labs projects are attributed to a work experience by thematic fit
-- (e.g. Health -> Humana, Earth -> Mimecast/London) so the gallery's client
-- column reads as varied rather than repeating "Ponti Studios" six times.
-- This is a demo-styling choice, not a claim these were built as employer
-- deliverables — see the top-of-file note on illustrative content.
INSERT INTO app.projects (
  portfolio_id, work_experience_id, title, short_description, description, technologies,
  github_url, live_url, status, is_featured, is_visible, sort_order, start_date
)
SELECT '565a8da7-0258-48de-80c9-edbed5e72e5b',
  (SELECT id FROM app.work_experiences
   WHERE portfolio_id = '565a8da7-0258-48de-80c9-edbed5e72e5b' AND company = v.company),
  v.title, v.short_description, v.description,
  v.technologies::jsonb, v.github_url, v.live_url, v.status, v.is_featured, true, v.sort_order,
  v.start_date::timestamptz
FROM (VALUES
  (
    'Craftd',
    'Track applications, interviews, and your professional pipeline',
    'A web app for managing a job search pipeline — applications, interviews, follow-ups, and offers — in one place.',
    '["TypeScript", "React", "Hono", "PostgreSQL"]',
    'https://github.com/ponti-studios/hominem',
    'https://career.ponti.io',
    'completed',
    true,
    1,
    '2026-06-16',
    'Ponti Studios'
  ),
  (
    'RealiTea',
    'Daily word game built on real headlines',
    'A daily word puzzle where players guess real celebrity names by spelling them out from clues, with new puzzles generated from actual entertainment journalism every day.',
    '["TypeScript", "React", "React Router", "PostgreSQL", "Drizzle"]',
    'https://github.com/ponti-studios/labs',
    'https://ponti.io/games/realitea',
    'completed',
    true,
    2,
    '2026-06-23',
    'Thomson Reuters'
  ),
  (
    'Earth',
    'Live map for exploring London traffic cameras',
    'A live geospatial viewer for browsing London''s TfL traffic camera network on an interactive map.',
    '["TypeScript", "React", "MapLibre", "PostgreSQL"]',
    'https://github.com/ponti-studios/labs',
    NULL,
    'in-progress',
    false,
    3,
    '2026-03-04',
    'Mimecast'
  ),
  (
    'Health',
    'Personal workspace for symptoms, care, and medication',
    'A personal health workspace for understanding symptoms, tracking progress, and organizing care.',
    '["TypeScript", "React", "React Router", "SQLite"]',
    'https://github.com/ponti-studios/labs',
    NULL,
    'in-progress',
    false,
    4,
    '2026-04-20',
    'Humana'
  ),
  (
    'Commune',
    'Anonymous peer deliberation for difficult decisions',
    'A social decision-making app that turns a personal situation into a neutral case for a small anonymous jury.',
    '["TypeScript", "React", "PostgreSQL", "AI"]',
    'https://github.com/ponti-studios/labs',
    NULL,
    'in-progress',
    false,
    5,
    '2026-05-06',
    'StreamYard'
  ),
  (
    'Foundation',
    'Enterprise shared infrastructure with Docker & PostgreSQL',
    'Shared infrastructure tooling for provisioning and running Docker and PostgreSQL services across projects.',
    '["Docker", "PostgreSQL", "GitHub Actions"]',
    'https://github.com/ponti-studios/foundation',
    NULL,
    'completed',
    false,
    6,
    NULL,
    'S&P Global'
  )
) AS v(title, short_description, description, technologies, github_url, live_url, status, is_featured, sort_order, start_date, company)
WHERE NOT EXISTS (
  SELECT 1 FROM app.projects WHERE portfolio_id = '565a8da7-0258-48de-80c9-edbed5e72e5b'
);

INSERT INTO app.testimonials (
  portfolio_id, name, title, company, content, rating, is_verified, is_visible, sort_order
)
SELECT '565a8da7-0258-48de-80c9-edbed5e72e5b', v.name, v.title, v.company, v.content, v.rating, false, true, v.sort_order
FROM (VALUES
  (
    'Maya R.',
    'Engineering Manager',
    'Airbnb',
    'Charles shipped our onboarding redesign in half the time we''d scoped, and it held up perfectly under production load. Rare to find someone who moves that fast without cutting corners.',
    5,
    1
  ),
  (
    'Devon K.',
    'Product Lead',
    'Netflix',
    'One of the few engineers I''ve worked with who can go from a rough product idea to a working prototype in a single sprint, and explain the trade-offs clearly the whole way through.',
    5,
    2
  ),
  (
    'Priya S.',
    'Staff Engineer',
    'Reddit',
    'He rebuilt our recommendation pipeline end-to-end and cut infra costs by a meaningful margin in the process. Deep technical judgment paired with genuine product sense.',
    5,
    3
  ),
  (
    'Jordan T.',
    'VP Engineering',
    'HubSpot',
    'Sharp technical judgment, and even sharper at explaining it to non-technical stakeholders. Made our roadmap planning noticeably easier.',
    5,
    4
  ),
  (
    'Sam L.',
    'Founder',
    'Seed-stage startup',
    'Brought us from a rough prototype to production-ready in six weeks flat, and set up the kind of foundation that didn''t need a rewrite a year later.',
    5,
    5
  )
) AS v(name, title, company, content, rating, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM app.testimonials WHERE portfolio_id = '565a8da7-0258-48de-80c9-edbed5e72e5b'
);

COMMIT;
