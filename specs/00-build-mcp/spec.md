# Feature Specification: Build MCP

**Feature Branch**: `00-build-mcp`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Provide one secure, read-only remote MCP server that domain plans can attach to without creating their own transports, authentication paths, or ad-hoc tool contracts.

## Clarifications

### Session 2026-07-11

- Q: What mechanism controls which domain tools are enabled (per FR-013)? → A: Conditional imports via `MCP_ENABLED_SCOPES` env var. Tool modules are only imported (and thus registered) if their scope is listed in the env var.
- Q: Does ChatGPT need a separate OAuth client vs generic MCP OAuth? → A: No distinction needed. The Better Auth MCP plugin provides generic OAuth 2.0 with per-client registration, consent, and revocation. ChatGPT is just another registered client.
- Q: What constitutes a passing evaluation run? → A: Deterministic-only scoring. Only deterministic checks (tool choice, argument schema match, scope enforcement, result structure) are gating. LLM quality scoring is advisory only.
- Q: Should there be rate limiting on MCP tool calls? → A: Both per-user rate limit (5 req/s per user, returning 429) and cost-based throttling (track AI usage cost per user, throttle when daily budget exceeded).
- Q: How should evaluation score a tool call that returns no data? → A: No-data is valid. Score based on correct tool selection and well-formed response structure, not presence of data.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Base MCP Server with Streamable HTTP Transport (Priority: P1)

As a domain plan implementer, I want the MCP server running over authenticated Streamable HTTP in `services/api` so that I can attach domain tools without building transport or auth infrastructure.

**Why this priority**: Every domain tool depends on this foundation — no transport, no tools.

**Independent Test**: A tool can be declared once (name, input/output/evidence schemas, sensitivity, scope), invoked via Streamable HTTP with Better Auth credentials, and receive a typed response.

**Acceptance Scenarios**:

1. **Given** the MCP server is running in `services/api`, **When** a client connects via Streamable HTTP with valid Better Auth credentials, **Then** the server responds and tool discovery returns registered capabilities.
2. **Given** a client connects without valid credentials, **When** it sends a request, **Then** the server returns an authentication error and no tool is invocable.
3. **Given** a tool is declared with runtime input/output/evidence schemas, sensitivity, scope, audit event, and result cap, **When** invoked, **Then** it calls an application service (not a repository or SQL) and returns a bounded typed response.

### User Story 2 - Privacy and Security Controls (Priority: P1)

As a user, I want AI to access my data only through narrow, attributable capabilities so that my private records remain private by default.

**Why this priority**: The foundational security promise — without it, no domain can safely enable MCP access.

**Independent Test**: A tool with a declared scope cannot be invoked without that scope being granted; responses exclude raw provider payloads, SQL, storage paths, attachments, and unrestricted message content.

**Acceptance Scenarios**:

1. **Given** a tool requires scope `career:read`, **When** invoked without a grant for that scope, **Then** the invocation is denied.
2. **Given** a tool returns evidence from a domain record, **When** the response is inspected, **Then** it contains no raw provider payloads, database credentials, storage paths, or unrestricted message bodies.
3. **Given** a capability returns no matching data, **When** invoked, **Then** it reports no-data rather than implying completeness.

### User Story 3 - ChatGPT OAuth Integration (Priority: P2)

As a ChatGPT user, I want to connect my Hominem data through a distinct OAuth client with explicit consent and revocation.

**Why this priority**: ChatGPT is the primary external MCP client; consent and revocation are required for production.

**Independent Test**: A ChatGPT OAuth client with revocable grants can authenticate, tools respect grant scope, and revocation immediately denies further access.

**Acceptance Scenarios**:

1. **Given** a ChatGPT OAuth client is configured, **When** authentication completes, **Then** the client receives a revocable grant with explicit scope consent.
2. **Given** a grant is revoked, **When** the client attempts a tool invocation, **Then** the server denies access.

### User Story 4 - LLM Evaluation Harness (Priority: P2)

As a developer, I want a versioned, fixture-backed LLM evaluation suite that exercises the real MCP transport so that I can measure tool choice, argument validity, authorization, grounding, and safety.

**Why this priority**: Domain tools cannot be enabled without passing evaluation — this harness gates all subsequent work.

**Independent Test**: A set of synthetic-fixture scenarios with expected tool traces, arguments, authorization checks, and safety rules produces a scored report with deterministic checks and quality scores.

**Acceptance Scenarios**:

1. **Given** synthetic fixture data for Career and Omiro workspace domains, **When** the evaluation harness runs, **Then** it records tool traces, arguments, authorization results, and response evidence for each scenario.
2. **Given** an evaluation run, **When** completed, **Then** the report captures model/configuration, deterministic check results, quality scores with evaluator rationale, latency, and cost.

### Edge Cases

- What happens when a tool is invoked with a result that exceeds its declared result cap?
- How does the system handle a revoked grant mid-session?
- How does evaluation handle a model that correctly declines to use any tool?
- What happens when pnpm workspace resolution blocks SDK installation?
- **No-data + evidence**: Evaluation scores no-data responses on correct tool selection and well-formed response structure, not on data presence. An empty result is valid per FR-006.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The MCP server MUST run over authenticated Streamable HTTP hosted by `services/api`.
- **FR-002**: Better Auth MUST remain the identity authority for all MCP tool invocation.
- **FR-003**: Every tool MUST be declared once with runtime input/output/evidence schemas, sensitivity, scope, audit event, and result cap.
- **FR-004**: Tools MUST invoke application services only — neither the transport nor a tool MAY access a repository or SQL directly.
- **FR-005**: AI MUST NEVER receive database credentials, SQL, raw provider payloads, storage paths, private files, attachments, broad table dumps, or unrestricted message bodies.
- **FR-006**: Every result MUST identify minimal canonical evidence; a capability MUST report no-data rather than implying completeness.
- **FR-007**: MCP v1 MUST be read-only. Mutation tools, generic exports, generic semantic search, agent-framework data access, and high-risk domains are out of scope.
- **FR-008**: ChatGPT MUST authenticate via the generic MCP OAuth 2.0 flow (Better Auth MCP plugin) with explicit consent and revocable grants — no separate OAuth server is needed.
- **FR-009**: Transport tests MUST prove discovery, invocation, scope denial, revocation, no-data, bounded results, and redaction.
- **FR-010**: A versioned synthetic-fixture evaluation suite MUST exercise the real MCP transport with at minimum Career and Omiro workspace scenarios.
- **FR-011**: Evaluation reports MUST capture model/configuration, tool-call traces, deterministic checks, quality scores, evaluator rationale, latency, and cost.
- **FR-012**: Each enabled domain tool MUST add positive, no-data, denied-scope, and redaction/leakage evaluation cases; its PR subset MUST pass before release.
- **FR-013**: No domain scope MAY be enabled before its domain plan's acceptance criteria are complete. Tool module imports MUST be gated by a `MCP_ENABLED_SCOPES` environment variable — only scopes listed in the variable cause their tool modules to be imported and registered.
- **FR-014**: MCP tool invocations MUST be rate-limited per authenticated user (5 req/s, returning HTTP 429 on excess).
- **FR-015**: AI usage cost per user MUST be tracked via `app.ai_usage_events`; when a daily cost budget is exceeded, further invocations MUST be throttled.

### Key Entities

- **app.entities**: Owner-scoped registry for selected typed domain rows. Supports tags, spaces, and explicit cross-domain links. Never the primary domain model.
- **app.entity_links**: Records real relationships between entities.
- **app.ai_usage_events**: Records operational AI usage (provider, feature, model, token counts, cost) without storing prompts or private-content evidence. Feature enum includes `mcp_tool_call` for MCP tool invocations.
- **MCP Capability**: Narrow, typed read model over an application service. Declares scope, sensitivity ceiling, input/output/evidence schemas, result cap, and audit event.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The official `@modelcontextprotocol/sdk` is installed and the base server runs over authenticated Streamable HTTP in `services/api`.
- **SC-002**: A tool can be declared once with all required metadata and invokes only application services.
- **SC-003**: ChatGPT uses a separate OAuth client with consent and revocation — transport tests prove discovery, invocation, scope denial, revocation, no-data, bounded results, and redaction.
- **SC-004**: A versioned synthetic-fixture evaluation suite exercises the real MCP transport with Career and Omiro workspace scenarios.
- **SC-005**: Evaluation reports capture model/configuration, tool-call traces, deterministic check results (pass/fail per check), and advisory quality scores with evaluator rationale, latency, and cost.
- **SC-006**: Each enabled domain tool adds positive, no-data, denied-scope, and redaction/leakage evaluation cases.
- **SC-007**: No domain scope is enabled before its domain plan's acceptance criteria are complete.

## Assumptions

- Better Auth provides the identity and session resolution infrastructure — no custom auth is built.
- The pnpm workspace resolution blocker (`ERR_PNPM_MISSING_TIME`) is resolved before SDK installation.
- The first MCP verticals are Career (`career:read`) and Omiro workspace (`knowledge:read`).
- Calendar, finance, health, communications, file access, and every mutation tool remain deferred for v1.
- The evaluation harness evaluates deterministic checks (tool choice, argument schema match, scope enforcement, result structure) as gating criteria. LLM quality scoring is recorded but advisory only. Pass thresholds are per-deterministic-check: all must pass.
- Domain plans may build their schema and private application services independently but cannot expose a remote tool until Plan 00 passes its acceptance criteria.
