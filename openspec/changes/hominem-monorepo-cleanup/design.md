## Context

The monorepo currently has 50+ identified issues ranging from critical (archive bug causing permanent data loss) to structural (unnecessary abstraction layers). The previous team applied "enterprise patterns" uniformly without evaluating cost-benefit, resulting in:

- **Unnecessary layers**: Repository pattern, service layer, component wrappers with zero business logic
- **Duplication**: 70% code overlap between web and mobile (auth, note editor), env validation replicated 4 times
- **Dead packages**: `@hominem/services` exports nothing, queues package incomplete
- **Type unsafety**: Double casts (`as unknown as Type`), JSON column handling without validation
- **Inconsistency**: Different error handling, form patterns, loading indicators across apps
- **Critical bugs**: `archiveNote()` performs hard delete, type guards missing for database records

The team values best practices, zero overengineering, consistency, and simplicity. This design prioritizes deleting unnecessary code, extracting shared logic, and establishing clear ownership boundaries.

## Goals / Non-Goals

**Goals:**
- Reduce codebase complexity by 30-40% (delete unnecessary abstractions)
- Eliminate duplication between web and mobile (extract shared hooks and logic)
- Fix critical bugs (archive, type safety, middleware duplication)
- Standardize patterns (env config, query keys, error handling, form handling)
- Improve TypeScript safety (type guards for JSON data, remove unsafe casts)
- Establish clear dependency graph and ownership boundaries
- Enable faster feature development by reducing cognitive load

**Non-Goals:**
- Rewrite working features (only fix/simplify structure)
- Change UI/UX (architectural cleanup only)
- Migrate to different frameworks (Hono, React, Expo stay as-is)
- Add new features (phase 4 is defect elimination and cleanup only)
- Refactor test infrastructure (tests work, optimize incrementally)

## Decisions

### Decision 1: Delete vs. Refactor Repositories
**Question**: Repository pattern is unmaintainable (static objects, no interfaces). Keep or delete?

**Decision**: **DELETE entirely**. Repositories add no value here.
- **Rationale**: Repositories are thin wrappers around Kysely queries with zero business logic. They don't encapsulate domain rules, don't provide testability (static objects can't be mocked), and don't abstract the database layer (callers still know it's Postgres). The "benefit" of swappable storage is fake (no one swaps relational DBs). Removing them simplifies the codebase and clarifies data flow.
- **Implementation**: Routes import and call Kysely queries directly (already doing this for `createNote`). Keep the domain logic (validation, error handling) but move it to route handlers or standalone helpers.
- **Alternatives considered**: 
  - A) Refactor to interface-based classes (adds 200+ LOC, still doesn't justify the layer)
  - B) Keep static repositories but add interfaces (reduces value vs. deletion)

### Decision 2: Service Layer Consolidation
**Question**: `NoteService`, `ChatService`, etc. are mostly passthroughs to repositories. Keep or delete?

**Decision**: **DELETE passthrough methods. Keep only orchestration logic.**
- **Rationale**: 80% of service methods are 1-liners delegating to repositories. Keep only methods that contain business logic (e.g., `createNote` derives title + excerpt, syncs files, validates ownership). This reduces a layer and clarifies which code is infrastructure vs. business logic.
- **Implementation**: For `NoteService`, keep `createNote()` and `updateNote()`. Delete `getNote()`, `listNotes()`, `deleteNote()` (hard delete is bug; replace with soft-delete logic). Routes call repositories for simple CRUD, services for complex operations.
- **Alternatives considered**:
  - A) Delete entire service layer (loses orchestration logic like file syncing)
  - B) Rename service to `NoteOrchestration` to clarify purpose

### Decision 3: @hominem/services Package Structure
**Question**: Package exports nothing, contains unrelated utilities (AI models, voice services, Redis, file processing). Keep or delete?

**Decision**: **CONSOLIDATE into focused sub-packages**. If not reused across APIs, inline into `services/api`.
- **Rationale**: The package is a junk drawer. Each utility should be independently useful. Group related items:
  - `@hominem/platform/ai` — AI model factories (used by voice + text generation)
  - `@hominem/platform/voice` — Voice services (transcription, speech, response)
  - Inline into API: Redis client, Resend client, file processor (only consumed by API)
- **Implementation**: 
  - Create `packages/platform/ai/` with `ai-model.ts` exports + types
  - Create `packages/platform/voice/` with consolidated voice services (fix error hierarchy)
  - Delete `@hominem/services/src/index.ts` empty export
  - Move remaining files to `services/api/src/` or new focused packages
- **Alternatives considered**:
  - A) Delete package entirely (loses shared AI abstraction)
  - B) Keep as dumping ground (status quo, continues accumulating junk)

### Decision 4: Web ↔ Mobile Code Sharing
**Question**: Auth flows, note editor logic, query keys duplicated across apps. Extract to shared hooks?

**Decision**: **YES. Extract to `packages/platform/hooks/` and `packages/platform/query-keys/`.**
- **Rationale**: 70-85% duplicate code is maintenance burden and divergence risk. Shared hooks abstract the logic (not UI), allowing apps to provide platform-specific UI wrapping.
- **Implementation**:
  - `packages/platform/hooks/use-note-editor.ts` — Returns `{ title, setTitle, content, setContent, debouncedSave, ... }`
  - `packages/platform/hooks/use-email-auth.ts` — Returns `{ email, setEmail, error, isSubmitting, submitLogin, ... }`
  - `packages/platform/query-keys/` — Single source for all React Query keys
  - Apps import hooks and wrap with platform-specific UI/navigation
- **Alternatives considered**:
  - A) Keep duplication (status quo, 2x maintenance cost)
  - B) Force code into `packages/domains/` (wrong layer; hooks are infrastructure, not business logic)

### Decision 5: Environment Configuration
**Question**: Env validation replicated in 4 places (core/env, api, services, web). Consolidate?

**Decision**: **YES. Create `packages/core/config` with base + layer-specific schemas.**
- **Rationale**: Duplication = drift risk. Single source of truth for shared keys (OPENROUTER_API_KEY, DATABASE_URL, etc.), with layer-specific extensions (API needs COOKIE_SECRET, web needs VITE_* variables).
- **Implementation**:
  - `packages/core/config/src/base.ts` — Shared keys (DB, AI provider, etc.)
  - `packages/core/config/src/api.ts` — API-specific extensions
  - `packages/core/config/src/web.ts` — Web-specific extensions
  - `packages/core/config/src/mobile.ts` — Mobile-specific extensions
  - Remove Proxy pattern in `core/env` (clever but adds debugging difficulty)
- **Alternatives considered**:
  - A) Keep 4 separate schemas (continue duplicating)
  - B) Single mega-schema with all keys (inflexible, leaks secrets to wrong layers)

### Decision 6: Voice Service Error Hierarchy
**Question**: Voice has 3 error classes + observability wrapper + test helpers (6 files supporting 3 service files, 43% scaffolding). Simplify?

**Decision**: **YES. Single `VoiceError` class with discriminated union codes.**
- **Rationale**: Multiple error classes add zero value over a single error type with a `code` field. The observability wrapper is just logging—inline it. Test helpers are over-complicated—simplify to factory functions.
- **Implementation**:
  ```typescript
  // Single error class
  export class VoiceError extends Error {
    constructor(
      public code: 'TRANSCRIPTION_FAILED' | 'SPEECH_FAILED' | 'RESPONSE_FAILED',
      message: string,
      public context?: Record<string, unknown>
    ) { ... }
  }
  ```
- **Alternatives considered**:
  - A) Keep error hierarchy (26% overhead for zero benefit)
  - B) Use union of error types (harder to instantiate and catch)

### Decision 7: Archive Operation (Critical Bug Fix)
**Question**: `archiveNote()` calls `deleteNote()` (hard delete). Should be soft delete.

**Decision**: **Add `archived_at` timestamp, implement soft delete, clean up old archives.**
- **Rationale**: Users expect "Archive" to be recoverable. Permanent deletion is data loss.
- **Implementation**:
  - Add `archived_at: timestamp NULL` to notes table (migration)
  - Update `archiveNote()` to set `archived_at = NOW()`
  - Update queries to filter `archived_at IS NULL` (soft delete)
  - Add background job to hard-delete notes archived > 30 days (comply with privacy requests)
- **Alternatives considered**:
  - A) Keep hard delete (data loss bug, not acceptable)
  - B) Separate "soft delete" endpoint for recovery (overcomplicate UX)

### Decision 8: RPC Contracts vs. Implementation
**Question**: Contracts are stubs that drift from implementation. Contract-first or implementation-first?

**Decision**: **DELETE contracts. Derive types from implementation.**
- **Rationale**: Half-maintained contracts are worse than no contracts (developers ignore them when they diverge). The implementation (actual routes) is the source of truth. Tools can auto-generate contracts from implementation if needed (Hono can export route types).
- **Implementation**:
  - Delete `packages/platform/rpc/src/contracts/app.ts`
  - Use Hono's type inference on RPC client (`hc<typeof apiApp>`)
  - Add explicit route type exports to `services/api/src/rpc/app.ts` for clarity
- **Alternatives considered**:
  - A) Maintain contracts as spec (maintenance burden, conflicts with reality)
  - B) Contract-first design (major refactor, requires new workflow)

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| **Repository deletion breaks existing code** | Create codemods to update imports, run tests, verify all routes still work. Change is compile-safe (repository calls become direct query calls). |
| **Shared hooks become bottleneck** | Hooks are thin (pure logic), apps still own styling + navigation. If hook needs change, it's transparent to apps. Monitor for bloat and split if needed. |
| **Env config consolidation breaks CI/CD secrets** | Use feature flags + careful secrets management (GitHub Actions secrets). Test in staging first. Rollback plan: original env files are git history. |
| **Archive migration breaks existing data** | Data migration is safe (adds column, updates queries). Test on copy of production DB first. Rollback: revert migration, restore data from backups. |
| **Consolidated voice services lose granularity** | Error codes + context field provide same info as separate classes. HTTP status codes still map correctly (e.g., 400 for validation, 503 for service failure). Logging still works. |
| **Type guard creation introduces bugs** | Guard logic is tested (write tests for guards). Guards are runtime validators—bugs caught immediately. |
| **Deletion of service methods breaks unidentified callsites** | Search codebase for all usages before deletion. If hidden call found, convert to repository call or keep method. Tests will fail if something breaks. |

## Migration Plan

### Phase 1: Immediate Structural Fixes (30 min)
1. Remove `tools/*` from workspace declaration
2. Remove empty `scripts: {}` and `dependencies: {}` from root package.json
3. Fix trailing commas in 3 tsconfig files
4. Investigate `.fallow/` and `.opencode/` (document or delete)
5. Run `bun install` and `turbo check` to verify

### Phase 2: Dependency Alignment (1-2 hrs)
1. Update all vitest to 4.1.2 (remove per-package overrides)
2. Update core/db @types/node to ^25.4.0
3. Fix react-markdown version conflict (ui package to ^10.1.0)
4. Standardize all version ranges (exact versions, no tildes/carets)
5. Run full test suite to verify

### Phase 3: Architectural Refactors (2-3 days)
1. Create type guards for JSON column data (database layer)
2. Extract shared hooks (note-editor, email-auth)
3. Consolidate query keys to `packages/platform/query-keys/`
4. Create `packages/core/config` and consolidate env schemas
5. Delete `@hominem/services` passthrough methods or refactor to focused packages
6. Simplify voice services (consolidate errors, inline observability)
7. Fix archive bug (add archived_at column, soft delete logic)
8. Delete RPC contracts
9. Flatten component wrapper layers in web app
10. Run full test suite, fix failing tests

### Phase 4: Code Quality & Infrastructure (2-3 days)
1. Create Dockerfiles for API and web app
2. Delete empty `infra/kubernetes/` or implement it
3. Improve test assertions (replace `expect.any()` with concrete values)
4. Consolidate error handling patterns (single error formatter)
5. Standardize loading state components
6. Document final architecture in README

### Rollback Strategy
- **Phase 1-2**: Changes are additive/config-only. Rollback by reverting commits or editing files.
- **Phase 3**: Database migration (archive) requires backup restore. Other changes are code deletions—rollback by restoring git commits. Type guards don't break runtime (only add validation).
- **Phase 4**: Dockerfiles and tests are safe to revert.

Each phase includes running full test suite + type checking before proceeding to next phase.

## Open Questions

1. **Should archived notes be hard-deleted after 30 days?** (Privacy/GDPR compliance) — Assume YES for now, implement background job.
2. **What happens if a caller references a deleted service method?** — Search tools will catch. Tests will fail. Acceptable risk.
3. **Should `@hominem/rpc` client be regenerated from implementation?** — Yes, use Hono's type exports or automate client generation.
4. **Mobile-specific styling system?** — Keep as-is (NativeWind is fine, leave for separate refactor).
5. **Do queues have active consumers?** — If not, delete package. If yes, add consumers to package or document external deployment.
