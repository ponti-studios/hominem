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
`app.ai_usage_events` (all already exist in production; migration adds
`mcp_tool_call` to the ai_usage_events feature enum)

**Testing**: Vitest (existing) for unit/integration; MCP Streamable HTTP
integration suite; separate LLM evaluation harness with synthetic fixtures

**Target Platform**: Linux server (`services/api`)

**Project Type**: API server feature — adds MCP transport layer to existing Hono
API in `services/api`

**Performance Goals**: Tool invocation <500ms p95; bounded result caps prevent
unbounded response sizes; evaluation harness runs in <5 min for PR subset

**Constraints**: MCP v1 is read-only only; tools must invoke application
services (never repositories or SQL); `@modelcontextprotocol/sdk` installation
blocked by pnpm workspace `ERR_PNPM_MISSING_TIME` — this MUST be resolved first;
MCP tool invocations rate-limited to 5 req/s per user with HTTP 429 on excess;
daily AI cost budget per user tracked via `app.ai_usage_events` with throttling
when exceeded

**Scale/Scope**: Single server, multiple domain tools, multi-user with Better
Auth; first two domain tools are Career (`career:read`) and Omiro workspace
(`knowledge:read`); tool modules gated via `MCP_ENABLED_SCOPES` env var — only
scopes listed in the variable are imported and registered

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

**✅ III. Database Discipline** — No new tables needed. `app.entities`,
    `app.entity_links`, and `app.ai_usage_events` already exist in
    production. A small migration adds `mcp_tool_call` to the
    `ai_usage_events` feature CHECK constraint. Then `just db-migrate`
    and regenerate types.

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
│   ├── server.ts              # Streamable HTTP transport + tool handler
│   ├── routes.ts              # MCP auth middleware + route mounting + OAuth discovery
│   ├── tools.ts               # Generic tool registry (register/list/call)
│   ├── tools/
│   │   └── career.ts          # Career domain tool definitions
│   └── rate-limiter.ts        # Per-user sliding-window rate limiter
├── schemas/
│   └── career.schema.ts       # Zod schemas for Career tool input/output
├── application/
│   └── career.service.ts      # CareerService (wraps PortfolioRepository)
├── auth/
│   └── better-auth.ts         # Better Auth config with MCP plugin
└── server.ts                  # Main app — mounts OAuth discovery routes

packages/db/migrations/
└── 20260710110000_add_mcp_tool_call_feature_to_ai_usage.sql
```

**Structure Decision**: The MCP server lives within the existing `services/api`
workspace. A new `mcp/` directory holds the transport, tool registry, domain
tool modules, and rate limiter. Auth is handled by `mcp/routes.ts` which uses
the Better Auth MCP plugin for OAuth access tokens with fallback to session
cookies and `x-user-id` header for dev/test. OAuth discovery endpoints are
mounted at the server root. Database migrations live in `packages/db/migrations/`.
No new packages introduced (Principle I).

## Complexity Tracking

No constitution violations to justify.
