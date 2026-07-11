# Hominem implementation plans

Each numbered file in this directory is a PRD for one implementation vertical.
It is the build contract for its domain: start with its same-stem SQL
specification in `schema/`, then implement the repository, application service,
authenticated API boundary, MCP tool(s), and tests as one reviewed change.

`00-build-mcp.md` is the prerequisite for any domain MCP work. Domain plans may
build their schema and private application services independently, but they do
not expose a remote tool until the base MCP server has passed its acceptance
criteria.

## Required plan shape

Every domain plan states the product outcome, canonical data model, lifecycle
and privacy rules, exclusions, implementation constraints, and delivery
acceptance. A plan is complete only when all of these agree:

- `schema/<same-stem>.sql` defines the canonical database shape and constraints.
- A typed repository owns domain queries; it does not leak raw rows or generic
  table access.
- An application service applies the domain rules and returns bounded read
  models.
- RPC/API DTOs expose only the service read model.
- MCP tools call the service, declare their scope and sensitivity, and return
  bounded evidence. A plan may deliberately specify no MCP tool for v1.
- Tests cover data invariants, authorization/redaction, service behavior, and
  MCP transport behavior when a tool is enabled. Enabled tools also add
  synthetic-fixture LLM evaluation cases to Plan 00's harness.

## Build order

The numeric prefix is implementation priority, not an abstract taxonomy. The
first domain work extends the production applications and schemas already in
use; it does not invent a new data surface.

1. [00 Build MCP](00-build-mcp.md)
2. [01 Career and public portfolio](01-career-portfolio.md) (`apps/career`)
3. [02 Omiro workspace](02-omiro-workspace.md) (`apps/omiro`)
4. [03 Files, sources, and evidence](03-files-sources-evidence.md), which
   supports Omiro attachments and evidence redaction
5. [04 Calendar and time](04-calendar-time.md), followed by the remaining
   numbered domains in order through [14 Finance](14-finance.md)

Plans 01–02 are the MCP pilot verticals. Each must use its production schema,
repository/service boundary, and app semantics; a new MCP-only data model is
out of scope. Finance remains the final stage because its data is highly
sensitive even though `apps/finance` already uses its schema in production.

`docs/architecture/` contains cross-cutting references. It is not an
implementation queue. Historical approvals are in
[docs/architecture/APPROVAL.md](../architecture/APPROVAL.md).
