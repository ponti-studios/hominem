# Implementation Plan: Build MCP

**Branch**: `00-build-mcp` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/00-build-mcp/spec.md`

**Note**: This template is filled in by the plan workflow; its definition describes the execution workflow.

## Summary

Provide one secure, read-only remote MCP server that domain plans can attach to
without creating their own transports, authentication paths, or ad-hoc tool
contracts. The server lives in `services/api` over authenticated Streamable
HTTP, uses Better Auth for identity, and exposes tools through narrow,
attributable capabilities that invoke application services only.

## Technical Context

**Language/Version**: TypeScript 6.0.3, Node >= 24.14.1

**Primary Dependencies**: `@modelcontextprotocol/sdk@^1.29.0`, Hono (existing),
Better Auth (existing), BullMQ (existing), Zod for runtime schemas (existing)

**Storage**: PostgreSQL via Kysely — `app.entities`, `app.entity_links`,
`app.entity_attributes`, `app.ai_usage_events` (new migration required)

**Testing**: Vitest (existing) for unit/integration; MCP Streamable HTTP
integration suite; separate LLM evaluation harness with synthetic fixtures

**Target Platform**: Linux server (`services/api`)

**Project Type**: API server feature — adds MCP transport layer to existing Hono
API in `services/api`

**Performance Goals**: Tool invocation <500ms p95; bounded result caps prevent
unbounded response sizes; evaluation harness runs in <5 min for PR subset

**Constraints**: MCP v1 is read-only only; tools must invoke application
services (never repositories or SQL); `@modelcontextprotocol/sdk` installation
blocked by pnpm workspace `ERR_PNPM_MISSING_TIME` — this MUST be resolved first

**Scale/Scope**: Single server, multiple domain tools, multi-user with Better
Auth; first two domain tools are Career (`career:read`) and Omiro workspace
(`knowledge:read`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — still PASS.*

**✅ I. Monorepo Boundaries** — No new package introduced. The MCP server
    lives inside the existing `services/api` workspace. The
    `@modelcontextprotocol/sdk` dependency is added to `@hominem/api`
    directly. No circular dependencies created.

**✅ II. API-First Capability Boundary** — This feature IS the capability
    boundary. Tools invoke application services (not repositories or SQL).
    Every route validates input with runtime schemas, resolves identity
    via Better Auth, authorizes scope, calls a service, and returns typed
    errors. Compliant.

**⚠ III. Database Discipline** — Schema changes required: `app.entities`,
    `app.entity_links`, `app.entity_attributes`, `app.ai_usage_events`.
    These need a Goose migration and `just db-migrate` run. Must add
    migration to the implementation sequence.

**✅ IV. Quality Gates** — Implementation must pass `pnpm run check`
    (typecheck + lint + build + test) before merge. Standard requirement,
    no additional burden.

**✅ V. Simplicity & Platform Focus (YAGNI)** — The plan is focused:
    read-only MCP over Streamable HTTP, no mutation tools, no generic
    search, no agent-framework access. Mutation tools, calendar, finance,
    health, and communications are explicitly deferred. No Android concerns.
    Compliant.

**Gate verdict: PASS** — All gates clear. One minor flag (III) for
migration, which is a standard workflow item, not a violation.

## Project Structure

### Documentation (this feature)

```text
specs/00-build-mcp/
├── spec.md              # Feature specification
├── plan.md              # This file (plan workflow output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output — MCP tool contracts
└── tasks.md             # Phase 2 output (not created here)
```

### Source Code (repository root)

```text
services/api/src/
├── mcp/
│   ├── transport.ts          # Streamable HTTP transport handler
│   ├── capability-registry.ts # Tool registration and scoping
│   ├── personal-tools.ts     # Adapter: resolves Hominem user, enforces scope
│   └── schemas.ts            # Runtime input/output/evidence schemas
├── middleware/   
│   └── mcp-auth.ts           # Better Auth session resolution for MCP
└── app.entities schema via packages/db/migrations/  # Goose migration

services/api/tests/
├── mcp/
│   ├── transport.test.ts     # Streamable HTTP: discovery, invocation, denial
│   ├── auth.test.ts          # Scope denial, revocation, consent
│   ├── redaction.test.ts     # Evidence redaction, no-data, result caps
│   └── evaluation/           # LLM evaluation harness
│       ├── harness.ts        # Fixture setup, scenario runner, scoring
│       ├── scenarios/        # Career and Omiro workspace scenarios
│       └── reports/          # Versioned evaluation reports
```

**Structure Decision**: The MCP server lives within the existing `services/api`
workspace, not a new package. A new `mcp/` module directory holds the transport,
registry, tool adapter, and schemas. `middleware/` gets the MCP auth middleware.
Database migrations live in `packages/db/migrations/` per the standard workflow.
Tests mirror the source structure under `tests/mcp/`, plus the evaluation
harness in its own subdirectory. This avoids a new package (Principle I) and
keeps MCP as a capability of the existing API service.

## Complexity Tracking

No constitution violations to justify.
