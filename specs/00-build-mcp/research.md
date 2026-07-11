# Research: Build MCP

## Resolved Unknowns

### 1. pnpm workspace resolution blocker (`ERR_PNPM_MISSING_TIME`)

**Issue**: Installing `@modelcontextprotocol/sdk@^1.29.0` errors with `ERR_PNPM_MISSING_TIME` because `apps/omiro` depends on `react-refresh` packages whose npm metadata lacks a `time` field.

**Decision**: This is a pnpm workspace metadata resolution issue affecting all new dependencies, not specific to the MCP SDK. The fix options are:

- Add `react-refresh` as an explicit dependency or override in `apps/omiro/package.json` with a version that has complete metadata
- Update pnpm to a version that relaxes the `time` field requirement (check pnpm changelog for `>=11.x` regression fix)
- Pin `@modelcontextprotocol/sdk` to a version that doesn't trigger the broad workspace resolution path

**Best approach**: First check if a pnpm update (within 11.x minor) resolves it, then fall back to adding a `react-refresh` override in the omiro package.

### 2. MCP Streamable HTTP transport

**Reference**: `@modelcontextprotocol/sdk` provides a `StreamableHTTPServerTransport` class that wraps the MCP protocol over HTTP with SSE-style streaming. The server exposes a single endpoint that accepts POST requests with JSON-RPC messages and streams responses back.

**Integration with Hono**: The SDK's transport can be adapted as a Hono middleware or route handler. The pattern is:

1. Create a `Server` instance from the SDK with tool definitions
2. Create a `StreamableHTTPServerTransport` configured with the request/response session handling
3. Register the transport as a Hono route (`app.post('/mcp', handler)`)
4. Use Better Auth middleware to authenticate requests before they reach the MCP transport

**Alternative considered**: Raw WebSocket transport — rejected because spec requires Streamable HTTP for simpler deployment and compatibility.

### 3. ChatGPT OAuth client → Generic MCP OAuth plugin

**Updated**: 2026-07-11 (clarification session).

**Decision**: ChatGPT does NOT need a separate OAuth client. The Better Auth MCP plugin provides generic OAuth 2.0 with per-client registration, consent, and revocation. ChatGPT is just another registered client — no dedicated auth path is needed.

**Rationale**: Per YAGNI (Principle V), building parallel auth infrastructure for ChatGPT when the generic MCP OAuth already covers all MCP clients (Claude Code, Cursor, ChatGPT) is unnecessary complexity. The plugin already supports:
- Dynamic client registration
- Scoped consent (`career:read`, `knowledge:read`)
- Token issuance and revocation
- `getMcpSession()` for server-side token verification

**Implementation**: The MCP auth middleware calls `betterAuthServer.api.getMcpSession()` which validates any MCP-issued access token, regardless of which client it was issued to. No client-type branching needed.

### 4. LLM evaluation harness approach

**Updated**: 2026-07-11 (clarification session).

**Decision**: Deterministic-only scoring for gating. Only deterministic checks (tool choice, argument schema match, scope enforcement, result structure) are pass/fail. LLM quality scoring is recorded but advisory only.

**Rationale**: Quality scoring with an LLM-as-judge introduces non-determinism that makes CI gating unreliable. Deterministic checks — did the right tool get called? Were arguments valid? Was scope enforced? Did the response match the expected structure? — are objective, fast, and reproducible.

**Reference**: The harness evaluates an LLM acting as an MCP client against synthetic fixture data. Key design decisions:

- **Fixture model**: Synthetic data seeded into the test database using the same repositories/services that domain plans use. No real user data.
- **Scenario structure**: Each scenario has (a) user request text, (b) granted scopes, (c) fixture setup, (d) expected tool behavior, (e) expected answer constraints.
- **Scoring dimensions**: Tool choice, arguments, authorization, grounding, safety — with deterministic assertions for the first four and a configurable evaluator for answer quality.
- **Model selection**: TBD — should support interchangeable models via OpenRouter (which the project already uses via `@hominem/ai`). Baseline model(s) versioned with the scenarios.
- **Reporting**: Capture model/configuration, tool-call traces, deterministic check results, quality scores with evaluator rationale, latency, and cost per run.
- **No-data scoring**: Score based on correct tool selection and well-formed response structure, not data presence. Empty result from correctly called tool is a pass.

**Gating criteria**: All deterministic checks must pass. Advisory quality scores are recorded but do not block.

**Alternative considered**: Mock-based evaluation without a real LLM — rejected because the spec requires real LLM interaction to measure tool choice, grounding, and safety behavior.

**Best practice**: Two-tier testing — (a) deterministic unit tests for tool traces, arguments, auth, and redaction via Vitest + MCP transport, (b) LLM eval harness for end-to-end answer quality with OpenRouter as the model provider. The fast PR subset runs only deterministic tests; the full benchmark runs on CI.

## Technology choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| MCP Transport | Streamable HTTP (SDK built-in) | Standard MCP transport, simpler than WebSocket, supported by ChatGPT |
| Auth Provider | Better Auth (existing) | Already the project's identity authority — no new auth system |
| Runtime Schemas | Zod (existing) | Already used across the project's Hono RPC layer |
| Eval Models | OpenRouter (existing) | Already integrated via `@hominem/ai` — supports multiple model providers |
| Test Framework | Vitest (existing) | Already the project standard — both for transport tests and eval harness |
| DB | PostgreSQL via Kysely (existing) | New schema objects added via Goose migration |
| Tool Declaration | SDK's `Server.tool()` | Standard MCP tool registration with typed input/output schemas |

### 5. Rate limiting and abuse prevention

**Added**: 2026-07-11 (clarification session).

**Decision**: Two-layer throttling — per-user rate limit (5 req/s, HTTP 429 on excess) plus daily cost budget throttling tracked via `app.ai_usage_events`.

**Rationale**: MCP tool calls hit application services which query the database. Without rate limiting, an authenticated client (or buggy LLM) could issue hundreds of requests per second, overwhelming the API. A per-user limit is simple to implement (token bucket or sliding window) and catches the most common abuse pattern. Cost-based throttling adds a fiscal safety net: even within rate limits, a user shouldn't burn through an unlimited AI budget.

**Implementation**:
- **Rate limit**: Middleware-level counter per userId, resetting every second. Depends on `@hominem/rate-limiter` if available, otherwise a simple in-memory Map with TTL.
- **Cost throttle**: After each tool invocation, accumulate cost in `app.ai_usage_events`. Before invocation, query the user's daily total. If it exceeds a configurable budget, return 429 with a cost-exceeded message.
- Both limits are per-user, per-endpoint (`/api/mcp`).

**Alternatives considered**:
- Global rate limit: Too restrictive — one heavy user blocks everyone.
- No rate limit: Unacceptable for a production service exposing database-backed tools.

### 6. Tool enablement via MCP_ENABLED_SCOPES

**Added**: 2026-07-11 (clarification session).

**Decision**: Domain tools are gated by a `MCP_ENABLED_SCOPES` environment variable. Tool modules are only imported (and thus registered via `registerTool()`) if their scope is listed.

**Rationale**: FR-013 requires that no domain scope be enabled before its domain plan's acceptance criteria are complete. The simplest mechanism that satisfies this without building a runtime feature-flag system (YAGNI, Principle V) is conditional imports at startup. Adding a scope to the var and restarting enables the tools; removing it disables them.

**Implementation**: In `services/api/src/mcp/routes.ts`:
```typescript
const enabledScopes = new Set(
  (process.env.MCP_ENABLED_SCOPES ?? '').split(',').map(s => s.trim()).filter(Boolean)
);

if (enabledScopes.has('career:read')) {
  await import('./tools/career');
}
// Future: if (enabledScopes.has('knowledge:read')) ...
```

No env var (or empty) = no tools registered. Production sets `MCP_ENABLED_SCOPES=career:read,knowledge:read`.

**Alternatives considered**:
- Runtime feature flags with a database table: Overengineered for Plan 00. YAGNI.
- Compile-time `#ifdef`-style gating: Not idiomatic in TypeScript/Node.
