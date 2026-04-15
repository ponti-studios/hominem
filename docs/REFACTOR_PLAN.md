# Hominem Refactor Plan And Execution Record

**Status**: In Progress
**Last Updated**: 2026-04-15
**Stack**: TypeScript 5.9 · pnpm · Turbo · Hono · Kysely · React Router 7 · Expo 55

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Execution Record](#2-execution-record)
3. [Phase 1: Quick Wins](#phase-1-quick-wins)
4. [Phase 2: Structural Simplification](#phase-2-structural-simplification)
5. [Phase 3: Deeper Architectural Changes](#phase-3-deeper-architectural-changes)
6. [Risk & Safeguards](#risk--safeguards)
7. [What Not to Change](#what-not-to-change)

---

## 1. Executive Summary

### Current State

The monorepo has **14 internal packages** across `apps/`, `services/`, and `packages/`. Architecture is fundamentally sound with clear layer separation (core → platform → domains → apps), no circular dependencies, and well-scoped domain packages. However:

| Problem                                  | Severity | packages/platform/queues                 |
| ---------------------------------------- | -------- | ---------------------------------------- |
| **2 orphaned packages** — zero consumers | High     | `@hominem/presence`, `@hominem/hooks`    |
| **Duplicate queue factories**            | Medium   | `@hominem/queues` vs `@hominem/services` |
| **Type duplication**                     | Medium   | Domain types redefined in RPC            |
| **Identical files across packages**      | Low      | `chat.types.ts`, `referenced-notes.ts`   |
| **UI package sprawl**                    | Medium   | 335 files, expo deps in shared package   |

### 5 Highest-Payoff Refactors

| #   | Refactor                                                    | Est. Lines | Risk   |
| --- | ----------------------------------------------------------- | ---------- | ------ |
| 1   | Delete `@hominem/presence` + `@hominem/hooks`               | ~700       | None   |
| 2   | Consolidate queue factories                                 | ~51        | Low    |
| 3   | Fix RPC ↔ Chat type boundaries                              | ~100       | Low    |
| 4   | Delete duplicate files (chat.types.ts, referenced-notes.ts) | ~51        | None   |
| 5   | Audit `@hominem/ui` exports                                 | Variable   | Medium |

### Target Outcome

- **Fewer packages**: 14 → 12 (after deleting orphans)
- **Deduplicated code**: ~800+ lines removed minimum
- **Clearer ownership**: Single source of truth for types, queues, utilities
- **Reduced sync burden**: Types defined once, not in multiple places

---

## 2. Execution Record

### Current State

1. Phase 1 is complete.
2. Phase 2 is complete.
3. Phase 3 is in progress.

### High-Level Outcomes

1. Chat responses now stream end-to-end instead of blocking on full completion.
2. Voice responses now stream through the mobile voice flow.
3. Mobile draft persistence uses MMKV.
4. The mobile composer context has been split to reduce unnecessary re-renders.
5. Mobile shared design tokens now come from `@hominem/ui/tokens` instead of duplicated local definitions.

### Phase 3 Work Done

1. Web SSR/session flash fix.
2. Note search cursor pagination.
3. RPC rate limiting for expensive routes.
4. Voice logic inlined into the API router.
5. Queue package boundary cleanup.
6. Shared chat helper deduplication.

### Current Focus

1. Remaining package boundary cleanup.
2. Remaining Phase 3 product work.

## 3. Phase 1: Quick Wins

> Low-risk, high-leverage cleanup. No behavior changes. Validate with existing tests.

### Step 1.1 — Delete `@hominem/presence`

- [ ] **Confirm zero consumers** — run `rg "@hominem/presence"` across all source
- [ ] **Delete package directory**: `packages/domains/presence/`
- [ ] **Remove from workspace**: delete from `pnpm-workspace.yaml` if listed separately
- [ ] **Remove from tsconfig references**: delete reference in `tsconfig.json`
- [ ] **Verify build passes**: `pnpm --filter @hominem/api run typecheck`
- [ ] **Verify web builds**: `pnpm --filter @hominem/web run typecheck`
- [ ] **Verify mobile builds**: `pnpm --filter @hominem/mobile run typecheck`

**Files affected**: `packages/domains/presence/` (7 files, ~500 lines)
**Risk**: None — zero consumers confirmed
**Owner**: Principal Engineer

---

### Step 1.2 — Delete `@hominem/hooks`

- [ ] **Confirm zero imports** — run `rg "from '@hominem/hooks'"` and `rg "@hominem/hooks"` across all source
- [ ] **Delete package directory**: `packages/platform/hooks/`
- [ ] **Remove from tsconfig references**: delete reference in `tsconfig.json`
- [ ] **Remove from workspace dependencies**: delete from `apps/web/package.json` and `apps/mobile/package.json`
- [ ] **Verify build passes**: run full typecheck across all packages

**Files affected**: `packages/platform/hooks/` (4 files, ~200 lines)
**Risk**: None — package is declared as dependency but never imported
**Note**: `useErrorFormatting` duplicates `getErrorMessage` from `@hominem/utils` — this confirms the package was not needed

---

### Step 1.3 — Consolidate Queue Factories

**Problem**: Two packages create BullMQ queues independently:

- `@hominem/queues/src/index.ts` — exports singleton queue instances
- `@hominem/services/src/queues.ts` — `getOrCreateQueues()` factory

**Action**: Keep `@hominem/queues` as the single source of truth, remove queue creation from `@hominem/services`.

- [ ] **Audit current usage** — find all imports of both packages in API
  ```bash
  rg "@hominem/queues" services/api/
  rg "@hominem/services" services/api/
  ```
- [ ] **Verify `@hominem/queues` creates all needed queues**:
  - `importTransactionsQueue` ✅
  - `placePhotoEnrichQueue` ✅
  - `fileProcessingQueue` ✅
- [ ] **Verify `@hominem/services/queues.ts` only creates**:
  - `importTransactions`
  - `placePhotoEnrich`
  - (missing `fileProcessingQueue`)
- [ ] **Add `fileProcessingQueue` to `@hominem/queues/src/index.ts`** if not present
- [ ] **Update any API code importing from `@hominem/services/queues`**
- [ ] **Delete `@hominem/services/src/queues.ts`**
- [ ] **Update `@hominem/services/src/index.ts`** to remove queue exports
- [ ] **Verify API starts correctly** with queue workers
- [ ] **Run queue-related tests** if any exist

**Files affected**:

- Keep: `packages/platform/queues/src/index.ts`
- Delete: `packages/platform/services/src/queues.ts`

**Risk**: Low — confirm single import path in API
**Validation**: API queue workers initialize correctly

---

### Step 1.4 — Delete Duplicate `chat.types.ts`

**Problem**: `chat.types.ts` (44 lines) is **identical** in two locations:

- `apps/mobile/components/chat/chat.types.ts`
- `packages/platform/ui/src/components/chat/chat.types.ts`

**Action**: Move canonical definition to `@hominem/chat`, import from both locations.

- [ ] **Verify files are identical** — diff the two files
- [ ] **Check `@hominem/chat/src/`** already exports similar types:
  - `packages/domains/chat/src/chat.types.ts` has `Chat`, `ChatMessage` types
  - `ChatMessageItem` interface and `MarkdownComponent` type may be missing
- [ ] **Add missing exports to `@hominem/chat`**:
  - `ChatMessageItem` interface
  - `MarkdownComponent` type
  - `ChatIconName`, `ChatRenderIcon`
- [ ] **Update mobile import**:
  ```typescript
  // Before
  import type { ChatMessageItem, MarkdownComponent } from "../chat.types";
  // After
  import type { ChatMessageItem, MarkdownComponent } from "@hominem/chat";
  ```
- [ ] **Update platform/ui import**:
  ```typescript
  // Before
  import type {
    ChatMessageItem,
    MarkdownComponent,
  } from "@components/chat/chat.types";
  // After
  import type { ChatMessageItem, MarkdownComponent } from "@hominem/chat";
  ```
- [ ] **Delete both local copies**: `apps/mobile/components/chat/chat.types.ts` and `packages/platform/ui/src/components/chat/chat.types.ts`
- [ ] **TypeScript check**: ensure no breakages
- [ ] **Build both apps**: web and mobile

**Risk**: None — identical files, straightforward substitution
**Estimated reduction**: ~44 lines duplicated

---

### Step 1.5 — Delete Duplicate `referenced-notes.ts`

**Problem**: `referenced-notes.ts` (7 lines) is **identical** in two locations:

- `apps/mobile/components/chat/referenced-notes.ts`
- `packages/platform/ui/src/components/chat/referenced-notes.ts`

**Action**: Move to `@hominem/chat`, import from both.

- [ ] **Verify files are identical**
- [ ] **Add `getReferencedNoteLabel()` to `@hominem/chat`**
- [ ] **Update both locations to import from `@hominem/chat`**
- [ ] **Delete both local copies**
- [ ] **TypeScript and build verification**

**Risk**: None — 7-line utility function, identical in both places

---

### Step 1.6 — Clean Up `services/api/src/lib/`

**Problem**: API has its own `lib/` directory with utilities that belong in platform packages:

- `services/api/src/lib/email.ts` — Resend email setup
- `services/api/src/lib/redis.ts` — Redis connection

**Action**: Relocate to `@hominem/services`, delete `lib/`.

- [ ] **Audit `services/api/src/lib/` contents**
- [ ] **Check if `@hominem/services`** already has equivalent:
  - `@hominem/services/src/redis.ts` exists
  - `@hominem/services/src/resend.ts` exists
- [ ] **If duplicates exist in services**: update API to import from `@hominem/services`
- [ ] **If no duplicates**: move to `@hominem/services` with appropriate naming
- [ ] **Delete `services/api/src/lib/` directory**
- [ ] **Verify API still starts and sends email/connects to Redis**

**Risk**: Low — small utility modules
**Note**: API's `lib/redis.ts` may have different config than services — verify before deleting

---

## 4. Phase 2: Structural Simplification

> Medium-effort consolidations and boundary fixes. May require coordination across packages.

### Step 2.1 — Fix RPC ↔ Chat Type Boundaries

**Problem**: Primitive types (`JsonPrimitive`, `JsonValue`, `ChatMessageRole`) are defined in **both**:

- `packages/domains/chat/src/chat.types.ts`
- `packages/platform/rpc/src/types/chat.types.ts`

Additionally: `ChatMessage` vs `ChatMessageDto` naming inconsistency.

**Action**: RPC should import domain types and re-export for wire compatibility.

- [ ] **Audit all types in `@hominem/rpc/types/chat.types.ts`**:
  - Which are duplicates of `@hominem/chat`?
  - Which are RPC-specific (wire transport)?
- [ ] **Update `@hominem/rpc/types/chat.types.ts`**:
  - Import base types from `@hominem/chat`
  - Re-export as `ChatMessageDto` for wire format
  - Keep only RPC-specific augmentations
- [ ] **Fix naming**: ensure `ChatMessage` → `ChatMessageDto` in RPC wire types
- [ ] **Update all RPC consumers** (mobile, web, ui):
  ```typescript
  // Before
  import type { ChatMessage } from "@hominem/rpc/types/chat.types";
  // After
  import type { ChatMessageDto } from "@hominem/rpc/types/chat.types";
  ```
- [ ] **Use `z.infer<>` where possible**: derive types from Zod schemas instead of hand-writing interfaces
- [ ] **Verify with TypeScript**: `pnpm --filter @hominem/api run typecheck`
- [ ] **API contract tests**: verify response shapes unchanged

**Risk**: Low — pure type reorganization
**Estimated reduction**: ~100 lines duplicate type definitions

---

### Step 2.2 — Consolidate `ChatMessageDto` vs `Chat` Naming

**Problem**: Same concept called two things:

- Domain: `ChatMessage` (in `@hominem/chat`)
- RPC: `ChatMessageDto` (in `@hominem/rpc`)

**Action**: Standardize naming.

- [x] **Decide convention**: bare names for domain types, `Dto` suffix for wire types
- [x] **Propagate change across**:
  - `packages/platform/rpc/src/types/`
  - `packages/platform/rpc/src/schemas/`
  - `services/api/src/rpc/routes/chats.ts`
  - `apps/web/` imports
  - `apps/mobile/` imports
- [x] **TypeScript and build verification**

**Risk**: Low — rename only, update imports

**Note**: No additional code changes were needed after `2.1`; the naming convention is now explicit and consistent.

---

### Step 2.3 — Audit `@hominem/ui` Exports

**Problem**:

- 335 files / 24,560 lines — too large
- `expo-clipboard`, `expo-file-system`, `expo-haptics` in dependencies — mobile deps in web-targeted package
- Mobile has **another** `components/ui/` with duplicate components
- `@hominem/ui` must remain platform-neutral and contain no mobile-specific logic
- Native typography logic now lives only in the mobile app

**Action**: Comprehensive audit to separate web-only from cross-platform.

#### Audit Checklist

- [x] **List all exports** from `@hominem/ui/src/index.ts`
- [x] **Categorize each export**:
   - [x] Cross-platform (design tokens, base components with platform variants)
   - [x] Web-only (Radix UI, Tailwind-specific)
   - [x] Mobile deps accidentally included
- [x] **Identify `expo-*` dependencies** in `packages/platform/ui/package.json`:
   - [x] `expo-clipboard`
   - [x] `expo-file-system`
   - [x] `expo-haptics`
   - [x] Any others
- [x] **Check for `Platform.select()` usage** vs separate files (`*.native.ts`, `*.web.ts`)
- [x] **Audit mobile's `apps/mobile/components/ui/`**:
   - [x] List all components
   - [x] Compare with `@hominem/ui` equivalents
   - [x] Determine which should use shared package

#### Refactoring Actions

- [x] **Move mobile-only components** out of `@hominem/ui` to mobile app
- [x] **Move web-only components** to separate export or mark clearly
- [x] **Remove `expo-*` dependencies** from `@hominem/ui` if truly not needed
- [x] **Update mobile app** to use `@hominem/ui` for shared components where possible
- [x] **Ensure `@hominem/ui` contains no mobile-specific logic**; move any native-only behavior to mobile-local code
- [x] **Remove native typography logic from `@hominem/ui`**
- [x] **Remove `radiiNative` split** and use shared `radii` everywhere

**Risk**: Low — no source imports of removed `expo-*`/native packages were found
**Estimated reduction**: Small — unused dependency cleanup and token naming simplification

---

### Step 2.4 — Mobile Auth Convergence (Evaluate)

**Problem**: Mobile has its own auth infrastructure in `apps/mobile/services/auth/` while web uses shared `@hominem/auth/client`.

**Action**: Evaluate if mobile can use shared auth provider.

- [x] **Audit mobile auth directory**:
  - `boot.ts` — session boot sequence
  - `boot-session-store.ts` — session storage
  - `boot-user-profile.ts` — user profile loading
  - `passkey-hooks.ts` — passkey registration/assertion
- [x] **Compare with `@hominem/auth/client`**:
  - Shared provider only wraps the auth client and session hook
  - Mobile provider owns boot, cookie persistence, profile sync, analytics, and E2E behavior
- [x] **Determine feasibility**:
  - Can mobile use `AuthProvider` from `@hominem/auth/client`? No
  - Are there platform-specific reasons for separate boot sequence? Yes
- [ ] **If feasible**: plan migration to shared provider
- [x] **If not feasible**: document why mobile-specific auth exists, leave as-is

**Risk**: Medium — auth is security-critical
**Note**: This step may reveal mobile-specific requirements that justify the separate implementation. Do not force convergence if it reduces functionality or security.

**Conclusion**: Keep `apps/mobile/services/auth/` separate. It is not a thin wrapper around the shared auth client.

---

## 5. Phase 3: Deeper Architectural Changes

> Higher-effort changes with stronger migration planning. More validation required.

### Step 3.1 — Split `@hominem/utils` (Evaluate)

**Problem**: 15+ unrelated submodules in one package:

- S3 storage
- LangChain markdown splitting
- Date/time utilities
- Logging (server + client)
- Google API
- HTTP helpers
- Image processing
- Location utilities

**Action**: Split into focused packages.

#### Evaluation Checklist

- [ ] **Audit all consumers** of `@hominem/utils`:
  ```bash
  rg "@hominem/utils" --type ts -l
  ```
- [ ] **Map submodules to consumers**:
  - Who uses `storage/`?
  - Who uses `logger/`?
  - Who uses `dates.ts` / `time.ts`?
  - Who uses `markdown/`?
- [ ] **Identify natural groupings**:
  - Storage-bound: S3, upload helpers
  - Observability: logging
  - Text: markdown, date/time
  - Integrations: Google API, HTTP

#### If Splitting

- [ ] **Create new packages**:
  - `@hominem/storage` (S3/R2)
  - `@hominem/logging` (server + client logger)
  - `@hominem/date-utils` (dates, time)
- [ ] **Re-export from `@hominem/utils`** during transition:
  ```typescript
  // @hominem/utils/src/index.ts
  export { storageService } from "@hominem/storage";
  export { logger } from "@hominem/logging";
  ```
- [ ] **Update consumers** one by one
- [ ] **Remove re-exports** once all consumers migrate
- [ ] **Full test suite** validation

**Risk**: Medium — 7 packages depend on utils
**Estimated reduction**: Depends on scope — clarify boundaries, may not reduce lines significantly
**Alternative**: If consumers are too scattered, keep as-is with clear sub-path exports

---

### Step 3.2 — API Service Layer Consistency

**Problem**: Inconsistent use of service layer:

- `services/api/src/application/notes.service.ts` — uses service
- Direct repository calls in chats, files, tasks routes

**Action**: Audit and decide: use services consistently, or remove service layer?

#### Audit

- [ ] **List all routes** using direct repository calls
- [ ] **List all routes** using service layer
- [ ] **Compare complexity**:
  - Which operations need transaction wrapping?
  - Which are simple CRUD?
- [ ] **Check `@hominem/services`** for business logic vs thin wrappers

#### Options

**Option A: Consistent Service Layer**

- [ ] Create services for chats, files, tasks matching notes pattern
- [ ] Move business logic from handlers to services
- [ ] Ensure all services use `runInTransaction()` for writes

**Option B: Remove Service Layer**

- [ ] Move transaction boundaries to handlers explicitly
- [ ] Delete `@hominem/services` if it only wraps repositories
- [ ] Keep business logic in handlers or domain packages

**Recommendation**: Option A if business logic exists in handlers; Option B if services add no value.

---

### Step 3.3 — Validate Zod Schema ↔ DB Type Alignment

**Problem**: Potential drift between:

- Database schema (`@hominem/db/src/types/database.ts`)
- Zod validation schemas (`@hominem/rpc/src/schemas/`)
- API response types

**Action**: Ensure types are derived, not hand-copied.

- [ ] **Audit Zod schemas** for notes, tasks, chats, files
- [ ] **Compare field names/types** with DB table interfaces
- [ ] **Identify manual conversions** (mappers, inline transformations)
- [ ] **Consider `kysely-codegen` + `zod` integration** if not already used
- [ ] **Add CI check** to detect schema drift

**Risk**: Low — correctness improvement
**Note**: If schemas are manually maintained separate from DB, this is a source of bugs

---

## 6. Risk & Safeguards

### Areas Most Likely to Break

| Area              | Risk Level | Safeguards Required                                            |
| ----------------- | ---------- | -------------------------------------------------------------- |
| Queue operations  | **HIGH**   | Contract tests for queue names, integration tests with workers |
| Mobile auth flows | **HIGH**   | Full login/passkey flow testing on device                      |
| UI components     | **MEDIUM** | Build both platforms, storybook for shared components          |
| Type boundaries   | **LOW**    | TypeScript compilation, API response shape tests               |
| Package deletion  | **NONE**   | Git history preserved, easy to restore                         |

### Required Validation Steps

For every phase:

- [ ] **TypeScript compilation**: `pnpm run typecheck` across all packages
- [ ] **API build**: `pnpm --filter @hominem/api run build`
- [ ] **Web build**: `pnpm --filter @hominem/web run build`
- [ ] **Mobile build**: `pnpm --filter @hominem/mobile run build`
- [ ] **API tests**: `pnpm --filter @hominem/api run test`
- [ ] **Web tests**: `pnpm --filter @hominem/web run test`
- [ ] **Mobile tests**: `pnpm --filter @hominem/mobile run test`

### Rollback Plan

- [ ] All deleted packages recoverable from Git
- [ ] Type changes reversible by reverting import paths
- [ ] Queue changes require only updating import paths back

---

## 7. What NOT to Change

Even if messy, these areas should be left alone due to churn-to-benefit ratio:

| Area                                    | Why Keep As-Is                                            |
| --------------------------------------- | --------------------------------------------------------- |
| **Repository pattern in `@hominem/db`** | Works well, clear ownership, DbHandle abstraction is good |
| **Hono route organization**             | Domain-aligned, easy to navigate                          |
| **`@hominem/chat` domain package**      | Well-scoped, properly exported                            |
| **`@hominem/auth`**                     | Clean separation of server/client/auth concerns           |
| **`@hominem/telemetry`**                | Well-structured with platform separation                  |
| **`@hominem/env`**                      | Simple, clear Zod schemas, working well                   |
| **`@hominem/platform-utils`**           | Minimal, focused                                          |
| **Goose migrations**                    | No issues identified                                      |
| **Kysely setup**                        | No issues identified                                      |

---

## Progress Tracking

### Phase 1 — Quick Wins

| Step                                       | Status | Notes                                     |
| ------------------------------------------ | ------ | ----------------------------------------- |
| 1.1 Delete `@hominem/presence`             | ✅     | Done                                      |
| 1.2 Delete `@hominem/hooks`                | ✅     | Removed                                   |
| 1.3 Consolidate queue factories            | ✅     | Keep `@hominem/queues` as source of truth |
| 1.4 Delete duplicate `chat.types.ts`       | ✅     | Moved to `@hominem/chat`                  |
| 1.5 Delete duplicate `referenced-notes.ts` | ✅     | Moved to `@hominem/chat`                  |
| 1.6 Clean up `services/api/src/lib/`       | ✅     | Inlined wrappers into callers             |

### Phase 2 — Structural Simplification

| Step                                    | Status | Notes         |
| --------------------------------------- | ------ | ------------- |
| 2.1 Fix RPC ↔ Chat type boundaries      | ✅     | Domain types re-exported from RPC |
| 2.2 Consolidate `ChatMessageDto` naming | ✅     | Domain bare names, wire DTOs keep `Dto` suffix |
| 2.3 Audit `@hominem/ui` exports         | ✅     | Removed native logic and unused deps |
| 2.4 Mobile auth convergence             | ✅     | Keep separate |

### Phase 3 — Deeper Architectural Changes

| Step                              | Status | Notes                |
| --------------------------------- | ------ | -------------------- |
| 3.1 Split `@hominem/utils`        | ⬜     | Evaluate feasibility |
| 3.2 API service layer consistency | ⬜     |                      |
| 3.3 Zod ↔ DB type alignment       | ⬜     |                      |

---

## Appendix: Package Inventory

### Active Packages (Keep)

| Package                   | Path                          | Lines   | Dependents |
| ------------------------- | ----------------------------- | ------- | ---------- |
| `@hominem/web`            | `apps/web`                    | ~3,300  | —          |
| `@hominem/mobile`         | `apps/mobile`                 | ~9,000  | —          |
| `@hominem/api`            | `services/api`                | ~3,200  | —          |
| `@hominem/db`             | `packages/core/db`            | ~2,900  | 3          |
| `@hominem/env`            | `packages/core/env`           | ~200    | 5          |
| `@hominem/utils`          | `packages/core/utils`         | ~1,500  | 7          |
| `@hominem/auth`           | `packages/platform/auth`      | ~500    | 4          |
| `@hominem/rpc`            | `packages/platform/rpc`       | ~2,400  | 4          |
| `@hominem/services`       | `packages/platform/services`  | ~1,000  | 2          |
| `@hominem/queues`         | `packages/platform/queues`    | ~100    | 1          |
| `@hominem/telemetry`      | `packages/platform/telemetry` | ~300    | 2          |
| `@hominem/ui`             | `packages/platform/ui`        | ~24,600 | 2          |
| `@hominem/chat`           | `packages/domains/chat`       | ~800    | 4          |
| `@hominem/platform-utils` | `packages/platform/utils`     | ~50     | 2          |

### Orphaned Packages (Delete)

| Package             | Path                        | Lines | Consumers             |
| ------------------- | --------------------------- | ----- | --------------------- |
| `@hominem/presence` | `packages/domains/presence` | ~500  | **0**                 |
| `@hominem/hooks`    | `packages/platform/hooks`   | ~200  | **0** (declared only) |

---

_Update status checkboxes as work progresses._
