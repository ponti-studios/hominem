# Plan 01: Career and public portfolio

## Outcome

Extend the career history, job-search activity, and public-facing professional
profile already served by `apps/career` — including the platform's only
intentionally **public** data. The MCP vertical uses these production records;
it does not create a second career or portfolio model.

## Implementation boundary

- **Schema:** [schema/01-career-portfolio.sql](schema/01-career-portfolio.sql) and [row-level-security.sql](schema/row-level-security.sql)
- **Repository and service:** separate public portfolio projections from private career-management reads.
- **MCP:** after Plan 00, follow the public/private split and never expose private job-search or compensation data by default.

## Canonical entities and relationships

`app.portfolios` is the public career/CV site (slug, bio, tagline, contact info, `is_public`). It is populated from `app.work_experiences`, `app.skills`, `app.projects`, `app.certifications`, and `app.testimonials`, all scoped by `portfolio_id`. `app.portfolio_analytics` logs anonymous visitor events (view, contact-click, resume-download, ...) against a portfolio. `app.companies` and `app.job_applications` track job-search activity; `app.career_events` record promotions/raises/role changes tied to a `work_experience_id`. `app.goals`/`app.key_results` are general-purpose OKR tracking, not career-specific, but currently only referenced from this domain in practice. `app.application_files`/`app.application_notes` attach resumes, cover letters, and interview notes to a `job_applications` row.

## Lifecycle and invariants

`portfolios.slug` is a public, URL-safe identifier (`^[a-z0-9-]+$`, 3–50 chars) — collision-checked globally, not owner-scoped, because it resolves on a public route. New portfolios default to `is_public = false`; existing public portfolios are grandfathered as already opted in. Each portfolio sub-entity (`projects`, `skills`, `certifications`, `testimonials`, `work_experiences`) carries `is_visible`/`sort_order` for independent publish control without deleting the underlying record. `job_applications` carries extensive compensation fields (`salary_offered`, `salary_negotiated`, `total_comp_final`, `equity_offered`, ...) and timing metrics (`time_to_response`, `time_to_offer`, ...).

## Privacy classification

This plan has **two separate sensitivity tiers**, unlike every other domain plan:

- `app.portfolios` and its published sub-entities are **intentionally public** once `is_public`/`is_visible` is set — this is the one deliberate exception to [00 Build MCP](00-build-mcp.md)'s private-by-default rule.
- `app.job_applications`, `app.career_events`, and `app.work_experiences`' compensation fields (salary, bonus, equity) are **highly sensitive** — comparable to finance — and must never be exposed through the public portfolio route or to external AI by default, even though other fields on the same `work_experiences` row (role, company, dates) may be published.

Row-level publish gating for portfolio sub-entities **is enforced by RLS**, not left to the application: `projects`, `skills`, `testimonials`, and `work_experiences` each carry a `SELECT` policy of the form `is_portfolio_owner(portfolio_id) OR (is_visible = true AND can_read_portfolio(portfolio_id))` (see [row-level-security.sql](schema/row-level-security.sql)) — a non-owner querying with `is_visible = false` gets no row back, regardless of what the application code does. What RLS does **not** do is column-level redaction: because compensation and publish-visibility coexist on the same row (`work_experiences` holds both `base_salary` and `is_visible`), a `SELECT *` on an otherwise-visible, published work-experience row returns the compensation fields too — the application layer is responsible for excluding those columns before serving the public portfolio route. This is a narrower, but still real, risk surface: the row-visibility gate is solid, but a public-route query that selects `*` instead of an explicit column list would leak compensation data.

## Rejected models

- Compensation data appearing in `app.portfolios` or any public-route response.
- Treating `app.portfolios` (public career site) as the same concept as `app.spaces` (private collaboration) or a future investment "portfolio" — the name is not reused for anything else.

## Delivery acceptance

- [ ] Career repositories expose portfolios, projects, skills, testimonials, work experiences, applications, and career events.
- [ ] Services separate public portfolio reads from private career management reads.
- [ ] Public DTOs exclude compensation, exit notes, reporting hierarchy, benefits, and performance details.
- [ ] MCP career context follows the same public/private split and never exposes private job-search details by default.
- [ ] Tests cover publish gating, visible sub-entities, public redaction, owner-only private reads, and compensation-field exclusion.
- [ ] Deferred: splitting compensation into a separately scoped table and resolving public portfolio naming collision with future investing.

## Deferred work

None. Whether compensation fields should be split into a separate, more restrictively-scoped table (rather than living on the same row as publishable fields) is worth a follow-up product decision.
