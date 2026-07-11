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

### 3. Better Auth OAuth client for ChatGPT

**Reference**: Better Auth supports OAuth 2.0 client configuration via its `oauth` plugin. A ChatGPT-specific OAuth client is configured with:

- A unique client ID and secret for the ChatGPT integration
- Scoped grants (e.g., `career:read`, `knowledge:read`) that the user consents to
- Revocable grant tokens stored in Better Auth's session/access tables

**Implementation**: The MCP auth middleware checks:
1. Is the request from an external OAuth client (ChatGPT)?
2. Does the client have a valid grant with the required scope for the invoked tool?
3. Is the grant not revoked?

Better Auth's existing session resolution handles the ChatGPT flow through its standard OAuth plugin without custom token management.

**Alternative considered**: Custom JWT-based tokens — rejected because Better Auth already provides the OAuth infrastructure.

### 4. LLM evaluation harness approach

**Reference**: The harness evaluates an LLM acting as an MCP client against synthetic fixture data. Key design decisions:

- **Fixture model**: Synthetic data seeded into the test database using the same repositories/services that domain plans use. No real user data.
- **Scenario structure**: Each scenario has (a) user request text, (b) granted scopes, (c) fixture setup, (d) expected tool behavior, (e) expected answer constraints.
- **Scoring dimensions**: Tool choice, arguments, authorization, grounding, safety — with deterministic assertions for the first four and a configurable evaluator for answer quality.
- **Model selection**: TBD — should support interchangeable models via OpenRouter (which the project already uses via `@hominem/ai`). Baseline model(s) versioned with the scenarios.
- **Reporting**: Capture model/configuration, tool-call traces, deterministic check results, quality scores with evaluator rationale, latency, and cost per run.

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
