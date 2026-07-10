# Platform principles

## Purpose

Hominem is a private, AI-first personal data system: the user owns one coherent record of life, and AI may reason over that record only through bounded, attributable capabilities.

## Canonical model

Hominem stores durable entities, events, relationships, files, and source observations. Authored truth, source truth, and AI-derived claims are distinct. Every record has an owner, lifecycle, and provenance where it did not originate in Hominem.

`app.entities` is a lightweight, owner-scoped **registry** keyed by `(entity_table, entity_id)` — it lets tags, spaces, and cross-domain links reference selected domain rows uniformly. It is not the primary data model: domain facts always live in their own typed table (`finance_transactions`, `notes`, `possessions`, ...). `app.entities` never gains domain-specific columns. It is kept in sync automatically by `app.sync_entity_registry` triggers on the 18 participating tables; insert/update/delete on a participating domain table upserts or deletes its registry row; application code never writes to `app.entities` directly.

## Invariants

- Postgres is the canonical queryable store; private object storage retains original bytes.
- Product models follow human meaning, never legacy source layouts.
- AI output is derived, reviewable, and never silently replaces user or source truth.
- Cross-domain links are explicit records (`app.entity_links`), not implicit text conventions.

## Privacy and AI evidence

Personal domain data is private by default. One exception is explicit: [18-career-portfolio.md](18-career-portfolio.md) covers a deliberately public-facing profile (`app.portfolios`) that the owner opts into publishing; new records default private and grandfathered public records retain their existing opt-in state. Every other domain remains owner-scoped. AI answers cite the minimal canonical evidence, source label, and freshness needed to assess an answer; raw artifacts and sensitive fields are excluded unless a later capability explicitly permits them.

## Rejected models

- A universal `items` table as the primary domain-data model — see the `app.entities` registry note above for the one narrow, explicitly-scoped exception.
- A generic SQL/record-dump AI interface.
- Warehouse compatibility tables as product truth.

## Implementation readiness

- [ ] All new domain work updates the chapter and SQL specification before code.
- [ ] Repositories expose product concepts, not table-shaped generic records.
- [ ] API and MCP responses include minimal evidence and freshness rather than raw rows.
- [ ] Cross-domain links use `app.entities`/`app.entity_links` only when a real relationship exists.
- [ ] Tests prove private-by-default behavior for every new capability surface.
- [ ] Deferred: household ownership and mutation-capable AI tools.

## Open questions

None. Household ownership (multiple owners jointly holding one record) remains deferred. Same-user sharing and collaboration is not deferred — it is implemented; see [01-identity-ownership-privacy.md](01-identity-ownership-privacy.md).
