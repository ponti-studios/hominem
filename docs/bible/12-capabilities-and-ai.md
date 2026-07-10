# Capabilities and AI

## Purpose

Define how AI reasons over Hominem without turning the database into an unrestricted tool surface.

## Canonical capability model

Capabilities are narrow, typed read models over application services: search knowledge, inspect a timeline, summarize finance, provide people/place context, and report data freshness. Each capability has scope, sensitivity ceiling, result cap, evidence schema, and audit event.

## Invariants

AI never receives database credentials, SQL, source paths, broad table dumps, or raw artifacts. Retrieval is domain-aware and scoped to the authenticated owner. Derived facts require source links and confidence.

## Required AI evidence

Every factual result includes canonical record identity, domain, source label when imported, observed/imported time, and confidence where non-authored. A capability returns no-data explicitly rather than hallucinating completeness.

`app.ai_usage_events` is the cost/usage ledger for AI calls themselves (provider, feature, model, token counts, `cost_usd`) — it is operational telemetry about the AI layer, not a capability or a domain entity, and carries no user-content evidence beyond token counts.

## Rejected models

- Agent frameworks as a data-access layer.
- Generic query tools or unconstrained semantic search.
- AI-written facts presented as user-authored.

## Implementation readiness

- [ ] Capability registry defines scope, sensitivity ceiling, input schema, output schema, evidence schema, and result cap for each tool/read model.
- [ ] Services return no-data, unavailable, unauthorized, and validation errors as stable structured results.
- [ ] MCP tools call application services only and never repositories or SQL directly.
- [ ] AI usage events are recorded without storing prompts or private content unless explicitly approved.
- [ ] Tests contract-check every capability schema, evidence object, result cap, and no-data response.
- [ ] Deferred: mutation tools, generic semantic search, and agent-framework orchestration.

## Open questions

None.
