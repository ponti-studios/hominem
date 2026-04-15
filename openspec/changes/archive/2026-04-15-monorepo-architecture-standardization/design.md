## Context

The repo already has clear top-level apps and several shared package areas, but the internal structure is inconsistent. Similar concepts appear as `contracts.ts`, `schemas.ts`, `types-only.ts`, and `service.ts` files in different places, which makes boundary ownership unclear and encourages shape reuse across domain, transport, data, and UI layers.

This change is a cross-cutting architectural refactor. It needs explicit decisions before implementation so the resulting structure is consistent across web, mobile, API, and shared packages.

## Goals / Non-Goals

**Goals:**
- Establish one directional architecture across apps and packages.
- Standardize suffix-based filenames for domain, persistence, RPC, mapper, schema, UI view-model, and service concerns.
- Make cross-layer transitions explicit instead of implicit.
- Add enforceable boundary rules so new code cannot drift back into ambiguous patterns.
- Preserve product behavior while changing structure.

**Non-Goals:**
- Rewriting product features.
- Collapsing all code into a single shared package.
- Introducing extra abstraction layers without a boundary need.
- Renaming every file in the repo when a file already matches the target shape.

## Decisions

1. Keep the app roots (`apps/web`, `apps/mobile`, and any future API app) and standardize shared code around layer ownership.
   - Rationale: the current app layout already matches the target architecture and does not need a disruptive move.
   - Alternatives considered: a wholesale directory rewrite into a brand-new monorepo layout. Rejected because it increases churn without improving the boundary model.

2. Treat domain, data, and RPC as separate concerns with explicit conversion points.
   - Rationale: this prevents one `User` shape from being reused as a DB row, transport payload, and UI object.
   - Alternatives considered: continuing to share a single model across layers. Rejected because it hides dependency direction and makes schema drift likely.

3. Standardize file suffixes and rename ambiguous files to the narrowest valid meaning.
   - Rationale: filenames should tell the truth about file responsibility.
   - Alternatives considered: preserving legacy names like `contracts.ts` and `common.ts`. Rejected because they do not describe the boundary role well enough.

4. Put all cross-layer shape changes in `*.mapper.ts` files.
   - Rationale: explicit mapping makes ownership visible and keeps transformations out of handlers, components, and repositories.
   - Alternatives considered: inline conversion at call sites. Rejected because it spreads conversion logic and obscures boundary transitions.

5. Use runtime schemas at external boundaries and infer TypeScript types from them where appropriate.
   - Rationale: transport and persistence inputs need runtime validation, not only compile-time types.
   - Alternatives considered: handwritten interfaces as the primary boundary definition. Rejected because they do not validate live input.

6. Enforce dependency direction with workspace rules and import restrictions.
   - Rationale: architecture should be mechanically reinforced, not just documented.
   - Alternatives considered: relying on code review alone. Rejected because boundary drift will return over time.

7. Keep shared packages narrow and purpose-built.
   - Rationale: shared code should support a clearly named boundary or layer, not become a dumping ground.
   - Alternatives considered: a broad `shared` package. Rejected because it recreates the ambiguity this change is meant to remove.

## Risks / Trade-offs

- [Risk] Renaming and splitting files may create temporary import churn.
  [Mitigation] Move one feature area at a time and keep compatibility shims only where needed during migration.

- [Risk] Boundary rules may surface hidden coupling in existing code.
  [Mitigation] Fix the coupling at the first explicit boundary instead of allowing new direct imports.

- [Risk] Some current packages may not map cleanly to the target layer names.
  [Mitigation] Prefer precise ownership over forced renames; use `shared-infra` only when a package truly spans multiple layers.

## Migration Plan

1. Inventory current ambiguous files and layer leaks across apps and packages.
2. Introduce the target naming convention and map existing files to the narrowest correct suffix.
3. Split boundary transformations into `*.mapper.ts` files.
4. Move or isolate runtime schemas into `*.schema.ts` files at API/RPC boundaries.
5. Update imports to follow the one-way dependency flow.
6. Add or update lint and workspace boundary rules so invalid imports fail fast.
7. Remove deprecated ambiguous files after callers have migrated.

Rollback strategy:
- Keep behavior-preserving adapters while moving imports.
- If a package rename causes instability, restore the old import surface temporarily and complete the migration in smaller slices.

## Open Questions

- Should `packages/domains` become `packages/domain` immediately, or should it be normalized incrementally through package aliases first?
- Should `packages/platform/services` be split into `packages/data` and `packages/shared-infra`, or does it contain enough cross-cutting runtime code to justify keeping a narrower platform package?
- Which existing `contracts.ts` files are true transport contracts versus legacy mixed-concern modules that need to be split?
