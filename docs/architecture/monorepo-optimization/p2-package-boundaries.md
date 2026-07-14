# P2 Package Boundaries

Status: proposed
Goal: make package ownership boring, narrow, and enforceable

## Summary

P2 is the main architecture cleanup. The monorepo has a healthy top-level layout, but several packages carry multiple responsibilities. The goal is not to add a large abstraction layer. The goal is to reduce surprising imports and clarify which package owns which boundary.

## Current Shape

Strong package roles:

- `@hominem/env`: shared env schema ownership.
- `@hominem/telemetry`: logging and telemetry helpers.
- `@hominem/storage`: R2 storage and upload policy.
- `@hominem/ai`: AI provider and AI workflow helpers.
- `@hominem/chat`: shared chat domain/UI helpers.

Pressure points:

- `@hominem/api`: deployable service and public type-contract package.
- `@hominem/rpc`: client package, React Query provider, DTOs, schemas, and API-type consumer.
- `@hominem/db`: database access layer plus broad app convenience surface.
- `@hominem/services`: Redis, email, file processing, AI usage, and env helpers.
- `@hominem/finance-services`: useful domain logic, but broad source exports and heavy DB coupling.
- `@hominem/utils`: acceptable today, but should stay dependency-free and boring.

## Findings

### Authentication Is A Single API Boundary

The API previously resolved identity in the global middleware and again in the MCP
route. That duplicated Better Auth lookups and allowed MCP to maintain its own user,
session, E2E, and scope contract.

The target boundary is now:

- The API auth middleware resolves Better Auth sessions, MCP OAuth credentials, and the
  secret-gated E2E identity into one `auth` context.
- Route middleware checks whether that context is present and applies route-specific
  authorization.
- MCP adapts the canonical context to the MCP SDK and owns only tool scopes, rate
  limiting, and cost budgets.
- No route-specific middleware resolves a second user identity.

Evidence:

- [services/api/src/auth/types.ts](../../../services/api/src/auth/types.ts)
- [services/api/src/middleware/auth.ts](../../../services/api/src/middleware/auth.ts)
- [services/api/src/mcp/routes.ts](../../../services/api/src/mcp/routes.ts)
- [services/api/src/mcp/server.ts](../../../services/api/src/mcp/server.ts)

This boundary keeps authentication ownership in the API edge while allowing each route
family to express its own authorization policy.

### API Is Also A Contract Package

`@hominem/rpc` imports API types from the deployable service. App code also imports API route types directly.

Evidence:

- [packages/rpc/src/core/api-client.ts](../../../packages/rpc/src/core/api-client.ts)
- [apps/finance/app/lib/api.server.ts](../../../apps/finance/app/lib/api.server.ts)
- [apps/career/app/lib/api.server.ts](../../../apps/career/app/lib/api.server.ts)
- [services/api/package.json](../../../services/api/package.json)

Problem:

The deployable API package becomes a compile-time dependency of clients. That makes the service package part of the app/client type graph and blurs the direction of dependencies.

Target:

- Either extract a narrow `@hominem/api-contract` package, or
- Make `@hominem/rpc` own the exported client contract and generated types.

Avoid:

- Moving runtime handlers into a shared package.
- Creating a generic `contracts` dumping ground.

### Product Apps Import DB Directly

Product app code imports `@hominem/db` directly. Local inventory found 68 direct DB imports from product apps.

Evidence:

- [apps/career](../../../apps/career)
- [apps/finance](../../../apps/finance)
- [packages/db/src/index.ts](../../../packages/db/src/index.ts)

Problem:

Direct DB imports are not always wrong for SSR apps, but this repo mixes product models:

- Career behaves like a full-stack DB app.
- Finance behaves more like an RPC client.
- Omiro behaves like a mobile RPC client.

That asymmetry should be an explicit architecture decision, not accidental drift.

Target:

- If Career is a full-stack app, create an app-local server service layer and keep DB imports there.
- If Career should be API-backed, migrate route loaders/actions to RPC/API boundaries.
- Client components should not import DB types as their primary view model when a transport/domain type exists.

### `@hominem/services` Is A Bucket

The package contains unrelated backend concerns.

Evidence:

- [packages/services/src/index.ts](../../../packages/services/src/index.ts)
- [packages/services/src/redis.ts](../../../packages/services/src/redis.ts)
- [packages/services/src/resend.ts](../../../packages/services/src/resend.ts)
- [packages/services/src/files.ts](../../../packages/services/src/files.ts)

Problem:

The package name does not describe ownership. It invites unrelated infrastructure to accumulate.

Target:

- Move Redis ownership to API infrastructure or queues.
- Keep email local unless more than one deployable truly needs it; split to `@hominem/email` only if reuse is real.
- Keep file processing near API workers unless product apps need it directly.
- Delete the broad root barrel if it mainly hides unrelated imports.

### Broad Barrels Hide Boundaries

Root barrels make imports easy, but they weaken architecture when everything can import everything.

Evidence:

- [packages/db/src/index.ts](../../../packages/db/src/index.ts)
- [packages/ui/src/index.ts](../../../packages/ui/src/index.ts)
- [packages/finance/src/index.ts](../../../packages/finance/src/index.ts)

Target:

- Prefer stable subpath exports for real boundaries.
- Keep root exports small.
- Do not export test utilities from production-facing barrels.
- Make repository imports explicit by domain.

### Source-First Exports Are Useful But Need Discipline

Most packages export `src` directly. That is good for local development with Vite, Expo, tsx, and bundlers. Plain Node still needs loaders or bundled deploy artifacts.

Target:

- Keep source-first exports for internal workspaces.
- Production deployables should bundle/build explicitly.
- Package `build/` folders should not be treated as source of truth unless exports point there.

## Target Dependency Direction

```text
apps/omiro, apps/finance
  -> @hominem/rpc
  -> @hominem/auth/client
  -> @hominem/ui
  -> @hominem/utils

apps/career
  -> app-local server service layer
  -> @hominem/db only from server-owned files
  -> or @hominem/rpc if it becomes API-backed

services/api
  -> @hominem/db
  -> @hominem/env
  -> @hominem/telemetry
  -> domain packages

@hominem/rpc or @hominem/api-contract
  -> public transport contract only
  -> no deployable runtime dependency

@hominem/db
  -> schema/types/repositories/transactions
  -> narrow public exports
```

## Implementation Checklist

- [ ] Decide whether to create `@hominem/api-contract` or make `@hominem/rpc` own contracts.
- [ ] Remove `@hominem/rpc -> @hominem/api` dependency.
- [ ] Inventory and classify all app `@hominem/db` imports.
- [ ] Move Career DB access behind app-local server services or API/RPC.
- [ ] Split or collapse `@hominem/services`.
- [ ] Tighten DB/UI/finance root barrels.
- [ ] Keep authentication resolution in the API edge and prevent route-specific identity
      resolution from returning.
- [ ] Remove stale build artifacts if source-first exports remain the rule.

## Validation

```bash
just typecheck all
just check api
just check career
just check finance
just check mobile
pnpm exec turbo run test --filter=@hominem/api... --dry=json
```

The dry graph should not require upstream builds for source-first tests, and app/client packages should not depend on deployable service packages for runtime code.
