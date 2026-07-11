# Feature Specification: Career and Public Portfolio

**Feature Branch**: `01-career-portfolio`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Extend the career history, job-search activity, and public-facing professional profile served by `apps/career`. The MCP vertical uses production records; it does not create a second career or portfolio model.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Public Portfolio with Published Sub-Entities (Priority: P1)

As a user, I want a public career portfolio page (slug, bio, tagline, contact info) with independently publishable projects, skills, certifications, testimonials, and work experiences so that I can present a professional profile without sharing job-search details.

**Why this priority**: The public portfolio is the core user-facing feature of this domain.

**Independent Test**: A portfolio with `is_public: true` renders published sub-entities; a non-owner sees only `is_visible: true` sub-entities and no compensation or job-search data.

**Acceptance Scenarios**:

1. **Given** a portfolio has `is_public = true` and several work experiences with mixed `is_visible` flags, **When** a non-owner accesses the public route, **Then** only experiences with `is_visible = true` are returned.
2. **Given** a public portfolio route, **When** the response includes work experiences, **Then** compensation fields (salary, bonus, equity) and performance details are excluded from the DTO.

### User Story 2 - Private Career Management (Priority: P1)

As a user, I want to manage job applications, career events, and compensation data privately so that sensitive career activity is not exposed to the public or to MCP by default.

**Why this priority**: Private career data (applications, compensation, career events) is the user's sensitive domain — it must be protected behind the owner scope.

**Independent Test**: An authenticated owner can CRUD job applications, career events, and all work experience fields (including compensation); a non-owner sees no private data.

**Acceptance Scenarios**:

1. **Given** an owner has created job applications with compensation fields, **When** the owner queries their own career management endpoints, **Then** all application and compensation data is returned.
2. **Given** a non-owner (or MCP without scope) attempts to access the same endpoints, **Then** no private career data is returned.

### User Story 3 - MCP Career Context (Priority: P2)

As an AI assistant with `career:read` scope, I want to read public portfolio content and bounded career context so that I can answer questions about professional background without accessing compensation or job-search details.

**Why this priority**: This is one of the two MCP pilot verticals after Plan 00.

**Independent Test**: An MCP tool with `career:read` scope returns public portfolio data and bounded career context but no compensation or job-search fields.

**Acceptance Scenarios**:

1. **Given** an MCP tool with `career:read` scope, **When** it queries a published portfolio, **Then** it returns visible work experiences, skills, projects, certifications, and testimonials.
2. **Given** the same tool, **When** it attempts to access job application or compensation data, **Then** those fields are redacted or the request returns no-data.

### Edge Cases

- What happens when a portfolio slug is changed — do existing public links break?
- How does RLS interact with the public portfolio route when `is_visible` changes mid-query?
- What happens when a work experience has both `is_visible = true` and compensation data — does the public route accidentally leak compensation when selecting `*` instead of explicit columns?
- How does the system handle a portfolio with `is_public = false` on the public route?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `app.portfolios` MUST support a slug (`^[a-z0-9-]+$`, 3–50 chars) that is collision-checked globally, not owner-scoped.
- **FR-002**: New portfolios MUST default to `is_public = false`.
- **FR-003**: Each portfolio sub-entity (`projects`, `skills`, `certifications`, `testimonials`, `work_experiences`) MUST carry `is_visible` and `sort_order` for independent publish control.
- **FR-004**: RLS MUST enforce publish gating for portfolio sub-entities — a non-owner querying with `is_visible = false` gets no row back.
- **FR-005**: Public portfolio DTOs MUST explicitly exclude compensation fields, exit notes, reporting hierarchy, benefits, and performance details — even when selecting from a table that mixes publishable and non-publishable columns.
- **FR-006**: Career repositories MUST separate public portfolio reads from private career management reads.
- **FR-007**: MCP career context MUST follow the same public/private split and MUST NOT expose private job-search details by default.
- **FR-008**: Tests MUST cover publish gating, visible sub-entities, public redaction, owner-only private reads, and compensation-field exclusion.

### Key Entities

- **app.portfolios**: Public career/CV site (slug, bio, tagline, contact info, `is_public`).
- **app.work_experiences**: Work history with both publishable fields (role, company, dates) and sensitive fields (salary, bonus, equity).
- **app.skills**: Skills with publish control, scoped by portfolio.
- **app.projects**: Projects with publish control, scoped by portfolio.
- **app.certifications**: Certifications with publish control, scoped by portfolio.
- **app.testimonials**: Testimonials with publish control, scoped by portfolio.
- **app.portfolio_analytics**: Anonymous visitor events against a portfolio.
- **app.companies**: Employer entities for job-search activity.
- **app.job_applications**: Job applications with compensation fields and attached files.
- **app.career_events**: Promotions, raises, role changes tied to a work experience.
- **app.goals / app.key_results**: General-purpose OKR tracking (not career-specific but currently only referenced from this domain).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Career repositories expose portfolios, projects, skills, testimonials, work experiences, applications, and career events through typed methods.
- **SC-002**: Services separate public portfolio reads from private career management reads.
- **SC-003**: Public DTOs exclude compensation, exit notes, reporting hierarchy, benefits, and performance details.
- **SC-004**: MCP career context follows the same public/private split and never exposes private job-search details by default.
- **SC-005**: Tests cover publish gating, visible sub-entities, public redaction, owner-only private reads, and compensation-field exclusion.

## Assumptions

- The row-level publish gate is enforced by RLS (not just application code) as described — but column-level redaction is the application layer's responsibility.
- MCP is not enabled until Plan 00 passes its acceptance criteria.
- Compensation fields and public-facing fields coexist on the same row (`work_experiences`) — this is a known risk surface.
- Deferred: splitting compensation into a separately scoped table and resolving public portfolio naming collision with future investing.
