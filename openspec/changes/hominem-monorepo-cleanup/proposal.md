## Why

This monorepo was accreted carelessly, not designed intentionally. The codebase exhibits 30-40% unnecessary abstraction layers (repositories without interfaces, passthrough services, wrapper components, duplicated configuration), inconsistent patterns across web and mobile apps (auth flows, note editors, query keys), and several critical bugs (archive operation performing hard delete instead of soft delete, type-unsafe JSON column handling). A comprehensive forensic audit identified 50+ issues across architecture, TypeScript quality, React patterns, configuration, and tooling. Fixing these issues will reduce cognitive load, eliminate duplication, improve type safety, and enable faster feature development.

## What Changes

- **Delete/consolidate** unused abstractions (`@hominem/services` junk drawer, passthrough `NoteService` methods, repository pattern without interfaces, voice service scaffolding)
- **Standardize** patterns (query key management, auth flows, error handling, form handling, loading states) across web and mobile
- **Simplify** configuration (consolidate env schemas, flatten tsconfig hierarchy, standardize package exports, align dependency versions)
- **Extract shared code** between web and mobile (note editor logic, auth flows, error formatting)
- **Fix critical bugs** (archive = delete, type-unsafe JSON, incomplete middleware)
- **Establish boundaries** (clear dependency direction, reduced abstraction layers, single implementation paths)
- **Improve TypeScript** (remove unsafe casts, create type guards for JSON data, centralize types)

**BREAKING CHANGES**:
- `@hominem/services` package restructured (exports may change)
- Service layer simplified (some methods deleted)
- Env validation schemas consolidated (configuration structure changes)
- Repository pattern removed or refactored (if keeping, becomes interface-based)

## Capabilities

### New Capabilities

- `monorepo-cleanup-phase-1`: Immediate structural fixes (ghost workspace, empty fields, trailing commas, directory cleanup)
- `monorepo-cleanup-phase-2`: Dependency alignment (standardize vitest, @types/node, react versions, package exports)
- `monorepo-cleanup-phase-3`: Architectural refactors (simplify services, consolidate abstractions, extract shared code)
- `monorepo-cleanup-phase-4`: Code quality and infrastructure (type safety, test improvements, Docker setup, bug fixes)

### Modified Capabilities

- `error-handling`: Now centralized with single error handler + type guards for JSON data
- `configuration-management`: Consolidated env validation with single base schema
- `react-hooks`: Unified patterns across web and mobile (shared hooks for note editor, auth, mutations)
- `ui-components`: Standardized component API (children vs title, consistent props)
- `monorepo-dependency-graph`: Simplified (removed unnecessary packages and layers)

## Impact

**All packages and apps affected:**
- `apps/web` — Simplified components, extracted shared hooks, unified error/loading/form patterns
- `apps/mobile` — Shared auth flows, note editor hooks, consistent error handling
- `packages/core/*` — Consolidated env validation, improved type safety in database layer
- `packages/platform/*` — Restructured services, consolidated abstractions, unified API client patterns
- `packages/domains/*` — Simplified service layers, removed unnecessary repositories
- `services/api` — Simplified middleware, fixed critical bugs (archive, auth duplication)

**Breaking changes:**
- If `@hominem/services` is deleted, consumers must import from new locations
- If service layer is simplified, routes import repositories directly instead of services
- Env configuration structure changes (but functionality identical)
- Package exports may change (if consolidating)

**Testing impact:**
- All existing tests must verify against new structure
- Database tests need type guard verification
- Component tests simplified (fewer wrapper layers to mock)
