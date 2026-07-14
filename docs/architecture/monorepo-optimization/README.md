# Monorepo Optimization

Status: discovery
Created: 2026-07-14
Scope: command system, package boundaries, runtime environments, CI, deployment, and developer feedback loops

## Why This Exists

The command-system rebuild exposed useful architecture pressure points in the monorepo. The repo is not structurally broken, but it has several places where local development, package boundaries, runtime configuration, and deployment expectations are not yet telling the same story.

This folder preserves that research as a working architecture plan.

## Priority Docs

- [P0 Guardrails](./p0-guardrails.md): correctness, security, and safety issues that should be fixed before deeper reshaping.
- [P1 Runtime And Environment](./p1-runtime-and-environment.md): Node, pnpm, Docker, EAS, Railway, env schema, and generated-code truth.
- [P2 Package Boundaries](./p2-package-boundaries.md): API contracts, DB import surface, shared service packages, and source-first exports.
- [P3 CI And Product Reality](./p3-ci-and-product-reality.md): active product classification, workflow coverage, Turbo cache shape, and docs alignment.
- [Authentication Session Boundary](../authentication-session-boundary.md): deferred decision on Better Auth bearer sessions versus cookie and MCP OAuth authentication.

## Current Architecture Read

The high-level repo layout is reasonable:

- `apps/*` and `services/*` hold deployables.
- `packages/*` holds reusable libraries and cross-product code.
- `just` is now the canonical developer and CI interface.
- pnpm workspaces and Turbo are the package/task graph.
- Most workspace exports point at `src`, which makes local edits flow through without constant builds.

The problems are mostly boundary and truth problems:

- `@hominem/api` is both deployable service and type-contract package.
- `@hominem/db` is both database boundary and broad convenience import surface.
- `@hominem/services` is a mixed backend bucket.
- env schemas exist in multiple places.
- docs, command scopes, CI workflows, and deploy workflows disagree on which products are active.
- source-first packages reduce build friction, but stale `build/` artifacts and generated DB types still blur the story.

Recent deployment repairs added a related operational finding: a successful CI upload is
not the same thing as a successful production deployment. Railway service identity,
the archived build configuration, and the final remote deployment status each need an
explicit owner and verification step.

## Operating Principles

- Keep `just` as the only repo-level interface.
- Keep source-first workspace exports for local development where the runtime supports them.
- Make production builds explicit and boring.
- Keep generated artifacts explicit and drift-checked.
- Avoid new packages unless they clarify ownership.
- Prefer fewer public exports over broad barrels.
- Treat deployable services and reusable contracts as separate responsibilities.
- Give each production service one deployment authority and verify the remote rollout,
  not merely the upload command.
- Treat the repository, Railway service, configuration path, and deploy workflow as one
  versioned deployment target.

## Recommended Order

1. Fix P0 safety and correctness issues.
2. Normalize runtime and env ownership.
3. Simplify package boundaries.
4. Align CI and docs with the actual product portfolio.
