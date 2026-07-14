# Authentication Session Boundary

Status: deferred decision
Owner: API/authentication
Review when: an external client or new authentication transport requires a decision

## Decision

Keep Better Auth's `bearer()` plugin for now.

The repository does not currently show a first-party web, mobile, or server-rendered
client sending a Better Auth session token in `Authorization: Bearer`. Those clients use
Better Auth session cookies. However, the MCP contract and external MCP clients use
Bearer authorization for OAuth access tokens, and the repository does not prove that no
external consumer depends on Better Auth bearer sessions.

Do not remove the plugin until that external-consumer question is answered.

## Current Authentication Surfaces

### Better Auth session cookies

- Omiro persists and forwards the Better Auth session cookie.
- Finance uses browser credentials and the session cookie.
- Career forwards the incoming request cookie for server-side API calls.

### Better Auth bearer sessions

The API registers the Better Auth `bearer()` plugin in
`services/api/src/auth/better-auth.ts`. It allows `getSession()` to resolve a Better Auth
session from an `Authorization: Bearer` header.

No first-party runtime caller was found during the repository audit. References to this
mode remain in the MCP specifications, OpenAPI configuration, and authentication
comments, so the contract is not yet clean enough to remove without deliberate review.

### MCP OAuth bearer tokens

MCP clients use OAuth access tokens in the `Authorization` header. This is a separate
protocol from Better Auth's optional bearer-session plugin and must remain supported even
if the Better Auth plugin is eventually removed.

## Evidence Reviewed

- `apps/omiro/services/auth/hooks/use-auth-headers.ts` sends a `cookie` header.
- `apps/finance/app/lib/api/provider.tsx` relies on session credentials and explicitly
  documents that an authorization header is not used.
- `apps/career/app/lib/api.server.ts` forwards cookies and uses `credentials: 'include'`.
- `services/api/src/auth/better-auth.ts` registers `bearer()`.
- `services/api/src/server.ts` advertises cookie and bearer session auth in OpenAPI.
- `specs/00-build-mcp/quickstart.md` and
  `specs/00-build-mcp/contracts/mcp-tool-contract.md` describe bearer authorization,
  but those examples represent MCP access and are not proof of Better Auth bearer-session
  usage.

## Revisit Questions

Before removing `bearer()`:

- Are there external web, mobile, CLI, integration, or automation clients outside this
  repository calling Hominem with Better Auth session bearer tokens?
- Are any deployed clients using a cached or documented token flow that is absent from
  this repository?
- Is the MCP OAuth flow the only legitimate bearer authorization flow we want to support?
- Should the API OpenAPI document describe cookie authentication, MCP OAuth bearer
  authentication, or both at each route?
- Do any monitoring, partner, or deployment smoke tests depend on bearer sessions?

## Removal Plan

If the answers confirm that Better Auth bearer sessions are unused:

1. Remove `bearer()` from `services/api/src/auth/better-auth.ts`.
2. Update the shared auth resolver to support Better Auth cookies, MCP OAuth, and the
   explicit E2E path only.
3. Remove the phrase `bearer plugin token` from the OpenAPI security description.
4. Rewrite MCP specifications to distinguish MCP OAuth bearer tokens from Better Auth
   session cookies.
5. Add a regression test proving a Better Auth session token in `Authorization` is
   rejected while MCP OAuth bearer authentication remains valid.
6. Verify all production clients and external integrations before release.

## Guardrail

Do not remove MCP's `Authorization: Bearer` handling as part of this decision. Removing
the Better Auth bearer-session plugin and removing MCP OAuth bearer support are different
changes with different compatibility surfaces.
