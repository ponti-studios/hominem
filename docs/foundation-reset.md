# Foundation Reset Blueprint

## Thesis

Do not restart from an empty repository.

Rebuild the platform inside the current monorepo with a smaller public surface, stricter package boundaries, and thinner runtime layers. The repo already has solid primitives in the workspace model, database layer, auth, environment validation, telemetry, and app shells. The reset should preserve those strengths and remove structural drift.

## Preserve

- Bun workspaces and Turbo as the monorepo execution model.
- TypeScript project references and package-local build ownership.
- Hono for the HTTP API surface.
- Kysely plus SQL migrations for database access and schema evolution.
- Zod-backed environment validation with explicit client/server separation.
- Better Auth as the shared authentication platform.
- Vitest, Playwright, and Detox as the split test stack.

## Reset

- Package taxonomy so every workspace has one clear role.
- Dependency rules so apps, services, and domains do not bleed into each other.
- Service ownership so API stays a thin transport and composition layer instead of a business-logic bucket.
- Domain ownership so server logic, contracts, and UI bindings are not mixed arbitrarily.
- Legacy package sprawl so generated artifacts and ghost workspaces stop shaping the graph.

## Target Topology

```text
apps/
  web/
  mobile/
  desktop/

services/
  api/

packages/
  core/
    db/
    env/
    utils/
    telemetry/

  platform/
    auth/
    rpc/
    ui/

  domains/
    chat/
    events/
    health/
    jobs/
    notes/
    finance/
    places/
    invites/
    lists/
```

## Layer Rules

- `core` packages may depend only on other `core` packages.
- `platform` packages may depend on `core`, never on `apps` or `services`.
- `domain` packages may depend on `core` and selected `platform` contracts, never on app code.
- `services` may compose `domain`, `platform`, and `core` packages, but must not own durable business logic.
- `apps` may depend on `platform`, `ui`, and stable `domain` contracts, but must not import server-only code.
- Every workspace must publish a narrow public surface through explicit exports.

## Current Drift To Eliminate

- `packages/finance`, `packages/finance-react`, `packages/invites`, `packages/invites-react`, `packages/lists`, `packages/lists-react`, `packages/notes`, `packages/places`, and `packages/places-react` currently appear as legacy package roots or generated artifacts rather than active workspaces.
- `services/api` currently carries a wide dependency footprint across domain and infrastructure packages, which makes it the center of the graph instead of a thin transport layer.
- Some domain workspaces expose mixed concerns across UI, client hooks, and server implementation, which makes ownership and test scope ambiguous.
- App surfaces depend on feature packages directly instead of a smaller contract-first layer.

## Package Contract Standard

Every active workspace should answer these questions immediately:

- What layer does this package belong to: `core`, `platform`, `domain`, `service`, or `app`?
- What is its single responsibility?
- What are its public exports?
- Which other workspaces may legally depend on it?
- Which test types are required for changes in this workspace?

If a workspace cannot answer those questions, it is not ready to survive the reset.

## Migration Plan

### Phase 0

- Stop adding new workspaces until the target topology is accepted.
- Classify every existing workspace as `preserve`, `reshape`, `quarantine`, or `remove`.
- Treat ghost package roots and tracked build artifacts as quarantine candidates until proven necessary.

### Phase 1

- Stabilize `db`, `env`, `utils`, and `telemetry` as the permanent `core` layer.
- Stabilize `auth`, `rpc`, and `ui` as the permanent `platform` layer.
- Make every preserved package expose only explicit, documented entrypoints.

### Phase 2

- Reduce `services/api` to routing, middleware, request validation, transport mapping, and composition.
- Move durable business rules into domain packages.

### Phase 3

- Rebuild domain packages one by one behind clean public contracts.
- Keep each domain package small enough to own its schema access, server entrypoint, contracts, and tests.
- Do not reintroduce `*-react` style workspace splits unless they represent a real ownership boundary.

### Phase 4

- Make `apps/web`, `apps/mobile`, and `apps/desktop` consumers of stable contracts rather than owners of feature logic.
- Keep app workspaces focused on rendering, interaction, navigation, caching, and device integrations.
- Remove server-only imports from app dependency graphs.

### Phase 5

- Delete quarantined legacy workspaces once callers are migrated.
- Remove deprecated exports.
- Tighten CI so new drift cannot re-enter the repo.

## Immediate First Moves

1. Inventory every package directory and classify it as active code, generated output, or legacy residue.
2. Shrink `services/api` to a thin composition layer with fewer direct workspace dependencies.
3. Split mixed concern packages so UI bindings and server logic stop sharing the same public surface by default.
4. Establish a package template for new domains with explicit exports, tests, and allowed dependency directions.
5. Route CI through the same Compose files used locally so service definitions do not drift.
6. Add architecture guardrails to CI so ghost workspaces, cross-layer imports, and undeclared boundaries fail early.

## Do Not Do

- Do not create a brand new repository and attempt a big-bang rewrite.
- Do not rewrite all apps at the same time.
- Do not keep legacy package names or workspace splits just because they already exist.
- Do not allow services to remain the place where domain logic accumulates.

## Exit Criteria

- Every tracked workspace has a manifest, an owner, and a clear layer.
- The dependency graph is acyclic across `core`, `platform`, `domain`, `services`, and `apps`.
- `services/api` imports only public domain entrypoints and transport concerns.
- App workspaces compile without server-only imports.
- CI validates lint, build, tests, migrations, and architectural boundaries.
- Adding a new domain no longer requires inventing new structural rules.
