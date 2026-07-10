# Bible implementation plan

This document turns the Bible into an implementation queue. The chapters remain the product authority; this file defines how to build from them without re-litigating scope in every feature branch.

## Vertical definition

A vertical is complete only when these layers agree:

- Bible chapter: product meaning, privacy model, rejected models, and implementation readiness are current.
- SQL specification: tables, constraints, indexes, and RLS intent match the chapter.
- Repository: `@hominem/db` exposes typed persistence methods for the domain and hides table-shape quirks.
- Service: application services assemble owner-scoped read models, enforce authorization, and attach evidence/freshness.
- RPC: Hono routes validate input, return DTOs derived from runtime schemas, and expose stable errors.
- MCP: AI-facing capabilities call the same services, return capped evidence-bearing results, and never expose raw SQL, raw artifacts, or broad dumps.
- Tests: repository, service, RPC, MCP contract, redaction, and no-data behavior are covered at the risk level of the domain.

## Build order

### 0. Foundation rails

Source chapters: [00](00-platform-principles.md), [01](01-identity-ownership-privacy.md), [02](02-provenance-files-imports.md), [12](12-capabilities-and-ai.md), [13](13-api-client-architecture.md), [14](14-mcp-security-and-chatgpt.md).

Acceptance:

- [ ] Define shared service result and stable error conventions.
- [ ] Define shared evidence/freshness DTOs.
- [ ] Define API runtime-schema and DTO-generation convention.
- [ ] Define MCP capability registry shape: scope, sensitivity, input, output, evidence, cap.
- [ ] Keep production runtime-role/RLS hardening as deferred MVP scope.

### 1. Calendar

Source chapter: [03-calendar-time.md](03-calendar-time.md).

Acceptance:

- [ ] Build calendar repositories for upcoming, bounded search, detail, and source freshness.
- [ ] Build calendar service read models that preserve all-day and cancellation semantics.
- [ ] Add RPC calendar endpoints with input validation and metadata-only DTOs.
- [ ] Add MCP timeline/schedule tools backed by the calendar service.
- [ ] Test date windows, ordering, cancellation, all-day behavior, result caps, evidence, and redaction.

### 2. Finance

Source chapter: [04-finance.md](04-finance.md).

Acceptance:

- [ ] Build finance repositories for institutions, accounts, transactions, postings, categories, merchants, and statements.
- [ ] Build finance services for summaries, spending by period, merchant/category grouping, and account freshness.
- [ ] Add RPC finance endpoints with sensitive-field DTO boundaries.
- [ ] Add MCP finance summary tools behind explicit finance scope.
- [ ] Test money math, transaction/posting consistency, grouping, caps, evidence, and no unrestricted search.

### 3. Knowledge

Source chapter: [05-knowledge.md](05-knowledge.md).

Acceptance:

- [ ] Build knowledge repositories for notes, versions, chats, messages, tags, embeddings, and facts.
- [ ] Build services that separate authored content, imported content, and AI-derived facts.
- [ ] Add RPC note/chat/search endpoints with excerpt policies.
- [ ] Add MCP knowledge retrieval tools with source, freshness, confidence, and no-data responses.
- [ ] Test sharing, version selection, tag access, fact confidence, excerpt limits, and redaction.

### 4. People and organizations

Source chapter: [06-people-organizations.md](06-people-organizations.md).

Acceptance:

- [ ] Build repositories for people, aliases, contact methods, relationships, organizations, and memberships.
- [ ] Build services for scoped people context and uncertain identity resolution.
- [ ] Add RPC people/org endpoints with contact-method privacy rules.
- [ ] Add MCP people-context tools that return relationship evidence without dumping private contact data.
- [ ] Test alias search, organization membership, relationship direction, ambiguity, and contact redaction.

### 5. Places and travel

Source chapter: [07-places-travel.md](07-places-travel.md).

Acceptance:

- [ ] Build repositories for places, visits, trips, reservations, and travel segments.
- [ ] Build services for place context, timeline joins, itinerary summaries, and coarse location views.
- [ ] Add RPC places/travel endpoints with coordinate/address redaction.
- [ ] Add MCP place/travel tools with coarse labels, freshness, and evidence.
- [ ] Test visit windows, trip ordering, reservation/segment joins, exact-location redaction, and no-data behavior.

### 6. Career and public portfolio

Source chapter: [18-career-portfolio.md](18-career-portfolio.md).

Acceptance:

- [ ] Finish public/private career service separation.
- [ ] Keep public portfolio DTOs free of compensation, benefits, exit notes, reporting hierarchy, and performance details.
- [ ] Add owner-only private career management DTOs for job applications and career events.
- [ ] Add MCP career context only after public/private rules are encoded in service tests.
- [ ] Test publish gating, public redaction, private owner reads, and visible sub-entity behavior.

### 7. Music, video, and media

Source chapters: [09-media-reading.md](09-media-reading.md), [16-music.md](16-music.md), [17-video.md](17-video.md).

Acceptance:

- [ ] Build generic media repositories for works and consumption.
- [ ] Build music repositories for artists, albums, tracks, playlists, and listens.
- [ ] Build video repositories for channels and views.
- [ ] Add services and RPC endpoints that distinguish catalog metadata from personal history.
- [ ] Add MCP media summaries with bounded recency evidence.
- [ ] Test progress semantics, provider identity, playlist ordering, watch/listen completion, and sensitive-interest handling.

### 8. Purchases and possessions

Source chapter: [10-purchases-possessions.md](10-purchases-possessions.md).

Acceptance:

- [ ] Build repositories for orders, line items, possessions, and possession events.
- [ ] Build services for ownership lifecycle, warranties, repairs, and valuation summaries.
- [ ] Add RPC purchase/possession endpoints with receipt/file redaction.
- [ ] Add MCP possession context with bounded lifecycle evidence.
- [ ] Test order totals, line-item links, lifecycle status changes, event ordering, and receipt redaction.

### 9. Health

Source chapter: [08-health.md](08-health.md).

Acceptance:

- [ ] Build repositories for observations and activities only.
- [ ] Build services that preserve source, timestamp, unit, and original values.
- [ ] Add owner-scoped RPC health endpoints.
- [ ] Keep MCP health disabled until consent and safety rules are approved.
- [ ] Test unit preservation, source filters, sensitivity gating, no diagnosis behavior, and no external AI exposure.

### 10. Communications and social

Source chapter: [11-communications-social.md](11-communications-social.md).

Acceptance:

- [ ] Build repositories for threads and messages.
- [ ] Build services that minimize message body exposure and preserve sender/source evidence.
- [ ] Add owner-scoped RPC communications endpoints with excerpt limits.
- [ ] Keep MCP communications disabled until consent, participant boundaries, and safety rules are approved.
- [ ] Test thread search, sender mapping, excerpt caps, disabled external AI access, and source freshness.

### 11. Warehouse historical migration

Source chapter: [15-warehouse-historical-migration.md](15-warehouse-historical-migration.md).

Acceptance:

- [ ] Create field-level mapping only after the target Hominem vertical is accepted.
- [ ] Preserve unmapped legacy fields as raw payload or human-review decisions.
- [ ] Run migration only in a manual, repeatable, disposable/reviewed path.
- [ ] Accept migration by counts, checksums, aggregate comparisons, review queues, and sampled UI/MCP answers.
- [ ] Archive Warehouse after accepted migration; do not preserve it as a live product dependency.

## Cross-vertical test contract

Every vertical should include:

- [ ] Repository tests for query boundaries and ordering.
- [ ] Service tests for authorization, evidence, freshness, and no-data behavior.
- [ ] DTO tests for runtime validation and redaction.
- [ ] MCP contract tests when MCP is in scope for the vertical.
- [ ] A sampled natural-language test for at least one cross-domain answer once two related verticals exist.

## MVP cutline

The MVP should prove the personal-data product concept with a small number of high-signal capabilities:

- calendar timeline and search
- finance spending summaries
- knowledge retrieval across notes/chats
- people/place context where it improves answers
- career public/private redaction correctness

Everything else can be schema-ready and repository-ready without being exposed through MCP or product UI yet.
