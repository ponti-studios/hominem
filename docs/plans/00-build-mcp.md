# Plan 00: Build MCP

## Outcome

Provide one secure, read-only remote MCP server that domain plans can attach to
without creating their own transports, authentication paths, or ad-hoc tool
contracts. Hominem data remains private by default; AI can reason over it only
through narrow, attributable capabilities.

## Scope

This foundation owns the Streamable HTTP transport in `services/api`, Better
Auth session resolution, capability registration, scope enforcement, audit and
usage telemetry, redaction/evidence conventions, and MCP transport tests. It
also owns an LLM evaluation harness for the server. It does not own a business
domain's repository or tool semantics. The first adapters extend existing
production schemas and application read models; MCP does not introduce a
parallel data model for a product domain.

## Canonical model

`app.entities` is an owner-scoped registry for selected typed domain rows. It
supports tags, spaces, and explicit cross-domain links; it is never the primary
domain model. Domain facts remain in typed tables. `app.entity_links` records
real relationships and `app.entity_attributes` holds sparse, namespaced,
evidence-backed derived attributes.

MCP capabilities are narrow, typed read models over application services. Each
tool declares a scope, sensitivity ceiling, input/output/evidence schemas, a
result cap, and an audit event. Tools never query repositories or SQL directly.

`app.ai_usage_events` records operational AI usage (provider, feature, model,
token counts, and cost) without storing prompts or private-content evidence.

## Security rules

- Remote MCP uses authenticated Streamable HTTP hosted by `services/api`.
- Better Auth remains the identity authority. ChatGPT uses a distinct OAuth
  client with explicit consent and revocable grants.
- AI never receives database credentials, SQL, raw provider payloads, storage
  paths, private files, attachments, broad table dumps, or unrestricted message
  bodies.
- Every result identifies minimal canonical evidence; a capability reports
  no-data rather than implying completeness.
- MCP v1 is read-only. Mutation tools, generic exports, generic semantic
  search, agent-framework data access, and high-risk domains are out of scope.

## Implementation sequence

1. Resolve the pnpm workspace metadata issue and install the official
   `@modelcontextprotocol/sdk` in `@hominem/api`.
2. Add the authenticated Streamable HTTP route and adapt the capability
   registry in `services/api/src/mcp/personal-tools.ts`.
3. Resolve the Hominem user through Better Auth middleware.
4. Enforce declared per-tool scopes before invocation; add consent,
   revocation, rate limiting, and audit logging for external OAuth clients.
5. Add a real MCP-client integration suite for discovery, invocation, denial,
   revocation, redaction, no-data behavior, and result caps.
6. Add a versioned, fixture-backed LLM evaluation suite that connects to the
   real MCP transport and records model, prompt, tool-call trace, response,
   scores, and cost for every run.
7. Seed the suite with Career and Omiro workspace scenarios, then require each
   domain plan to add its own scenarios before its tool is enabled.
8. Only then enable an approved domain tool from its numbered plan.

## LLM evaluation harness

The harness evaluates an LLM acting as an MCP client against synthetic,
owner-scoped fixture data. It must never use a real user's private records. A
test case contains a user request, the granted scopes, fixture setup, expected
tool behavior, and expected answer/evidence constraints.

Every case scores the full interaction, not just the final prose:

- **Tool choice:** the model selects the expected tool or correctly declines
  when no tool should be used.
- **Arguments:** the call validates and expresses the requested date range,
  filters, and result limit without broadening access.
- **Authorization:** a missing/revoked scope is denied and the model does not
  evade that denial with another tool.
- **Grounding:** factual claims are supported by tool-returned evidence; the
  model reports no-data or uncertainty when the fixture cannot answer.
- **Safety:** the response does not reveal fields excluded by the capability,
  including raw payloads, account identifiers, storage paths, attachments, or
  unrestricted message content.

Use deterministic assertions for tool traces, arguments, authorization,
redaction, and evidence IDs. Use a separately configured evaluator only for
answer quality, with an explicit rubric and stored rationale. The baseline
model(s), pass thresholds, and evaluator configuration are **TBD**; version
them with the cases so results are comparable over time. The suite must support
both a fast PR subset and a fuller recorded benchmark run.

## Initial tool policy

The first MCP verticals extend the production apps: Career (`apps/career`) and
the Omiro workspace (`apps/omiro`). Their candidate scopes are `career:read`
and `knowledge:read`. Calendar is explicitly deferred until its numbered plan is
reopened later; no calendar schema, repository, API, or MCP tool is part of the
current MVP surface. Finance is the final planned domain and remains disabled
for external clients until consent, revocation, audit logging, scope-denial
tests, and security review are complete. Health, communications, file access,
and every mutation tool remain deferred.

## Delivery acceptance

- [ ] The official SDK is installed and the base server runs over authenticated
  Streamable HTTP in `services/api`.
- [ ] A tool is declared once with runtime input/output/evidence schemas,
  sensitivity, scope, audit event, and result cap.
- [ ] A tool invokes an application service only; neither the transport nor a
  tool accesses a repository or SQL directly.
- [ ] ChatGPT uses a separate OAuth client with consent and revocation.
- [ ] Tool responses exclude raw provider payloads, SQL, storage paths,
  attachments, and unrestricted message content.
- [ ] Transport tests prove discovery, invocation, scope denial, revocation,
  no-data, bounded results, and redaction.
- [ ] A versioned synthetic-fixture evaluation suite exercises the real MCP
  transport with Career and Omiro workspace scenarios.
- [ ] Evaluation reports capture model/configuration, tool-call traces,
  deterministic checks, quality scores, evaluator rationale, latency, and cost.
- [ ] Each enabled domain tool adds positive, no-data, denied-scope, and
  redaction/leakage evaluation cases; its PR subset passes before release.
- [ ] No domain scope is enabled before its domain plan's acceptance criteria
  are complete.

## Dependencies and blocker

Installing `@modelcontextprotocol/sdk@^1.29.0` is currently blocked by pnpm
workspace resolution: `apps/omiro` dependency metadata for `react-refresh`
lacks a `time` field (`ERR_PNPM_MISSING_TIME`). Fix that package-manager issue
before changing MCP dependencies.
