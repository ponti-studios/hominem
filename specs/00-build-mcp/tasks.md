---

description: "Task list for Build MCP feature implementation"
---

# Tasks: Build MCP

**Input**: Design documents from `specs/00-build-mcp/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are REQUIRED for all user stories per the feature specification (FR-009, FR-011, FR-012).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Paths in this task list use the project-relative structure from the plan:
- `services/api/src/mcp/` — MCP server source
- `services/api/src/middleware/` — MCP auth middleware
- `packages/db/migrations/` — Goose migrations
- `services/api/tests/mcp/` — Transport, auth, and redaction tests
- `services/api/tests/mcp/evaluation/` — LLM evaluation harness

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Resolve dependency blockers and prepare the workspace

- [ ] T001 Resolve pnpm workspace `ERR_PNPM_MISSING_TIME` issue blocking `@modelcontextprotocol/sdk` installation — investigate pnpm update or `react-refresh` override in `apps/omiro/package.json`
- [ ] T002 [P] Install `@modelcontextprotocol/sdk@^1.29.0` in `services/api`
- [ ] T003 [P] Add `@hominem/db` migration directory structure for new MCP tables

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create Goose migration for `app.entities`, `app.entity_links`, `app.entity_attributes`, and `app.ai_usage_events` in `packages/db/migrations/`
- [ ] T005 Run `just db-migrate` to apply migration and regenerate Kysely types
- [ ] T006 [P] Create MCP transport handler scaffolding in `services/api/src/mcp/transport.ts` — empty Streamable HTTP endpoint ready to wire
- [ ] T007 [P] Create MCP auth middleware in `services/api/src/middleware/mcp-auth.ts` — Better Auth session resolution for MCP requests
- [ ] T008 [P] Create capability registry scaffolding in `services/api/src/mcp/capability-registry.ts` — tool registration interface
- [ ] T009 [P] Create MCP schema definitions in `services/api/src/mcp/schemas.ts` — Zod schemas for input/output/evidence
- [ ] T010 [P] Set up MCP test infrastructure in `services/api/tests/mcp/` — helpers, mock data factories, fixture setup

**Checkpoint**: Foundation ready - MCP server skeleton exists, migrations applied, user story implementation can now begin

---

## Phase 3: User Story 1 - Base MCP Server with Streamable HTTP Transport (Priority: P1) 🎯 MVP

**Goal**: The MCP server runs over authenticated Streamable HTTP in `services/api`; tools can be declared, discovered, and invoked.

**Independent Test**: A tool declared with input/output schemas can be discovered via `tools/list`, invoked via `tools/call` with valid auth, and receives a typed response — all over Streamable HTTP at `POST /api/mcp`.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T011 [P] [US1] Transport discovery test in `services/api/tests/mcp/transport.test.ts` — `tools/list` returns registered tool names and schemas
- [ ] T012 [P] [US1] Transport invocation test in `services/api/tests/mcp/transport.test.ts` — `tools/call` with valid input returns correct typed response
- [ ] T013 [P] [US1] Transport auth test in `services/api/tests/mcp/transport.test.ts` — unauthenticated request returns auth error
- [ ] T014 [P] [US1] Transport invalid-input test in `services/api/tests/mcp/transport.test.ts` — request with invalid input schema returns validation error

### Implementation for User Story 1

- [ ] T015 [US1] Implement Streamable HTTP transport handler in `services/api/src/mcp/transport.ts` — Hono route wrapping `StreamableHTTPServerTransport`
- [ ] T016 [P] [US1] Implement tool declaration helper in `services/api/src/mcp/capability-registry.ts` — wraps SDK `Server.tool()` with scope/sensitivity/result cap metadata
- [ ] T017 [P] [US1] Implement runtime schema definitions in `services/api/src/mcp/schemas.ts` — Zod schemas for tool input, output, and evidence
- [ ] T018 [US1] Implement first Career tool (`get_career_portfolio`) in `services/api/src/mcp/personal-tools.ts` — tool definition with input/output schemas, scope, and service call
- [ ] T019 [US1] Wire MCP route into `services/api/src/index.ts` — register `POST /api/mcp` with auth middleware and transport handler
- [ ] T020 [US1] Register initial tool list (Career + Workspace tools) in capability registry
- [ ] T021 [US1] Add logging for MCP tool invocation in transport handler
- [ ] T022 [US1] Add validation error handling for malformed JSON-RPC requests

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Privacy and Security Controls (Priority: P1)

**Goal**: Tools enforce declared scopes, return bounded evidence with no raw provider data, and report no-data when appropriate.

**Independent Test**: A tool with declared scope cannot be invoked without that scope; responses exclude raw payloads, storage paths, and unrestricted content; no-data is reported when no matching records exist.

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T023 [P] [US2] Scope denial test in `services/api/tests/mcp/auth.test.ts` — tool invoked without required scope returns `-32001` error
- [ ] T024 [P] [US2] Evidence redaction test in `services/api/tests/mcp/redaction.test.ts` — tool response contains no raw provider payloads, DB credentials, storage paths, or unrestricted message bodies
- [ ] T025 [P] [US2] No-data test in `services/api/tests/mcp/redaction.test.ts` — tool with no matching records returns empty evidence and no-data text
- [ ] T026 [P] [US2] Result cap test in `services/api/tests/mcp/redaction.test.ts` — tool with more results than cap returns truncated response with `isTruncated: true`

### Implementation for User Story 2

- [ ] T027 [US2] Implement scope enforcement in `services/api/src/middleware/mcp-auth.ts` — check actor's granted scopes against tool's declared scope before invocation
- [ ] T028 [P] [US2] Implement evidence builder in `services/api/src/mcp/schemas.ts` — constructs bounded evidence array from domain service response, excluding raw/internal fields
- [ ] T029 [P] [US2] Implement result capping in `services/api/src/mcp/capability-registry.ts` — truncate results and set `isTruncated: true` when result cap exceeded
- [ ] T030 [US2] Implement no-data response in `services/api/src/mcp/transport.ts` — return empty evidence and descriptive text when service returns no records
- [ ] T031 [US2] Integrate scope checks into Career tool and first Workspace tool
- [ ] T032 [US2] Add redaction logging for evidence assembly

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - ChatGPT OAuth Integration (Priority: P2)

**Goal**: ChatGPT uses a separate OAuth client with explicit consent and revocable grants.

**Independent Test**: A ChatGPT OAuth client authenticates, tools respect grant scope, and revocation immediately denies further access.

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T033 [P] [US3] OAuth consent test in `services/api/tests/mcp/auth.test.ts` — ChatGPT OAuth client with valid grant can invoke tools within scope
- [ ] T034 [P] [US3] Grant revocation test in `services/api/tests/mcp/auth.test.ts` — revoked grant immediately denies tool invocation
- [ ] T035 [P] [US3] Scope mismatch test in `services/api/tests/mcp/auth.test.ts` — ChatGPT client with `knowledge:read` cannot invoke `career:read` tool

### Implementation for User Story 3

- [ ] T036 [US3] Configure ChatGPT OAuth client in Better Auth — separate client ID/secret with scoped grant support
- [ ] T037 [US3] Implement OAuth grant validation in `services/api/src/middleware/mcp-auth.ts` — resolve grant from Better Auth session, check scope, check revocation
- [ ] T038 [US3] Implement grant revocation endpoint or integration with Better Auth's revocation flow
- [ ] T039 [US3] Integrate ChatGPT OAuth flow with existing scope enforcement in MCP auth middleware
- [ ] T040 [US3] Add audit logging for ChatGPT OAuth consent and revocation events

**Checkpoint**: ChatGPT OAuth integration should be functional and independently testable

---

## Phase 6: User Story 4 - LLM Evaluation Harness (Priority: P2)

**Goal**: A versioned, fixture-backed LLM evaluation suite exercises the real MCP transport and measures tool choice, argument validity, authorization, grounding, and safety.

**Independent Test**: Synthetic-fixture scenarios produce a scored report with deterministic tool traces, arguments, authorization checks, and quality scores with evaluator rationale.

### Tests for User Story 4 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T041 [P] [US4] Harness scaffold test in `services/api/tests/mcp/evaluation/harness.test.ts` — harness can initialize with fixture data and run a dummy scenario
- [ ] T042 [P] [US4] Scoring dimension test in `services/api/tests/mcp/evaluation/harness.test.ts` — each dimension (tool choice, arguments, auth, grounding, safety) produces a score
- [ ] T043 [P] [US4] Report output test in `services/api/tests/mcp/evaluation/harness.test.ts` — evaluation run produces a report with model config, traces, checks, scores, latency, and cost

### Implementation for User Story 4

- [ ] T044 [P] [US4] Implement evaluation harness in `services/api/tests/mcp/evaluation/harness.ts` — scenario runner with fixture setup, LLM invocation via OpenRouter, trace recording
- [ ] T045 [P] [US4] Create Career fixture scenarios in `services/api/tests/mcp/evaluation/scenarios/career.ts` — positive, no-data, denied-scope, and redaction cases
- [ ] T046 [P] [US4] Create Workspace fixture scenarios in `services/api/tests/mcp/evaluation/scenarios/workspace.ts` — positive, no-data, denied-scope, and redaction cases
- [ ] T047 [US4] Implement deterministic assertions for tool choice, arguments, authorization, and evidence in harness
- [ ] T048 [US4] Implement quality evaluator integration (via OpenRouter or configurable evaluator) for answer scoring
- [ ] T049 [US4] Implement report generation in `services/api/tests/mcp/evaluation/reports/` — model config, trace output, scores, evaluator rationale, latency, cost
- [ ] T050 [US4] Configure fast PR subset (deterministic tests only) vs. full benchmark run

**Checkpoint**: LLM evaluation harness should be functional with Career and Workspace scenarios

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T051 [P] Update documentation: ensure `docs/architecture/mcp.md` or equivalent references this feature
- [ ] T052 [P] Run `pnpm run check` (typecheck + lint + build + test) across the full workspace
- [ ] T053 [P] Run quickstart.md validation scenarios to verify end-to-end functionality
- [ ] T054 Code cleanup and edge-case hardening across all MCP modules
- [ ] T055 [P] Address any security review findings before enabling domain tools

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational phase completion
  - US1 (Phase 3) and US2 (Phase 4) can proceed in parallel after Foundation
  - US3 (Phase 5) depends on US2 (scope enforcement must exist before OAuth)
  - US4 (Phase 6) depends on US1 (MCP transport must exist before eval harness)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational - no dependencies on other stories
- **US2 (P1)**: Can start after Foundational - no dependencies on other stories
- **US3 (P2)**: Depends on US2 scope enforcement
- **US4 (P2)**: Depends on US1 MCP transport

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/schemas before transport handlers
- Transport handlers before tool registration
- Tool registration before end-to-end integration
- Story complete before moving to next priority

### Parallel Opportunities

- T002, T003 can run in parallel
- T006, T007, T008, T009, T010 can run in parallel
- US1 and US2 can be implemented in parallel (different concerns)
- All tests for a user story marked [P] can run in parallel
- Career and Workspace fixture scenarios can be written in parallel
- Different user stories can be worked on in parallel by different team members once foundational phase is complete

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Base Server)
4. Complete Phase 4: User Story 2 (Privacy & Security)
5. **STOP and VALIDATE**: Test base server with auth, redaction, no-data
6. ChatGPT OAuth and LLM eval harness can be deferred

### Incremental Delivery

1. Setup + Foundational → MCP skeleton ready
2. US1 + US2 → Basic authenticated MCP server working
3. Add US3 → ChatGPT integration working
4. Add US4 → Evaluation harness for domain tool gating
