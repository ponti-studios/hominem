# Hominem Remote MCP Rollout

Hominem's remote MCP should expose capability-oriented, read-only tools on top of
the same application services used by web and mobile clients. It must not query
Warehouse snapshots, run imports, expose SQL, or bypass authenticated Hominem
service boundaries.

## Current status

The MCP-facing tool registry lives in `services/api/src/mcp/personal-tools.ts`.
It is intentionally transport-independent until the official MCP TypeScript SDK
can be installed in this workspace.

Implemented tools:

- `personal_calendar_search`
- `personal_calendar_upcoming`
- `personal_finance_monthly_summary`
- `personal_data_health`

Each tool is read-only, validates input with Zod, calls `@hominem/db`
capability repositories, and returns structured content plus text content that
an MCP adapter can pass through as a tool result.

## Auth model

The production transport should use authenticated Streamable HTTP. Better Auth
remains the authentication authority:

- first-party web uses Better Auth session cookies
- mobile or external clients use Better Auth-native bearer/JWT support
- ChatGPT gets a separate OAuth client, explicit consent, and revocable scopes

Initial MCP scopes should stay narrow:

- `calendar:read`
- `finance:read`
- `provenance:read`

Finance and provenance are implemented as contracts, but production access
should stay disabled until consent, audit logging, revocation, rate limits, and
security review are complete.

## SDK blocker

Attempting to install `@modelcontextprotocol/sdk@^1.29.0` currently fails during
workspace resolution because pnpm cannot resolve existing `apps/omiro`
dependency metadata:

```text
[ERR_PNPM_MISSING_TIME] The metadata of react-refresh is missing the "time" field
```

pnpm recommends `resolution-mode=highest`, but this pnpm version did not honor
the setting when passed as a CLI flag or temporary `.npmrc` entry in this
workspace. The next dependency step is to fix that package-manager metadata
issue, then add the official SDK to `@hominem/api`.

## Next implementation step

After the SDK installs:

1. Create a Streamable HTTP MCP route in `services/api`.
2. Resolve the authenticated Hominem user through Better Auth middleware.
3. Register the tools from `personal-tools.ts` with the MCP server.
4. Enforce scope checks before invoking each tool.
5. Add integration tests that initialize an MCP client, discover tools, and call
   every tool through the real HTTP transport.
