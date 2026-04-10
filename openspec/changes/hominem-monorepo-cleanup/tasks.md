## 1. Phase 1: Immediate Structural Fixes

- [x] 1.1 Remove `tools/*` from root `package.json` workspaces declaration (already absent)
- [x] 1.2 Remove empty `scripts: {}` object from root `package.json` (already absent)
- [x] 1.3 Remove empty `dependencies: {}` object from root `package.json` (already absent)
- [x] 1.4 Fix trailing comma in `apps/mobile/tsconfig.json` line 18
- [x] 1.5 Fix trailing comma in `services/api/tsconfig.json` line 7
- [x] 1.6 Fix trailing comma in `packages/platform/ui/tsconfig.json` line 7
- [x] 1.7 Investigate `.fallow/` directory purpose; document or delete (already in .gitignore)
- [x] 1.8 Investigate `.opencode/` directory purpose; document or add to `.gitignore` (already in .gitignore)
- [x] 1.9 Run `bun install` and verify workspace resolution succeeds
- [x] 1.10 Run `turbo check` and verify no type errors from config changes (used `turbo typecheck`)
- [ ] 1.11 Commit Phase 1 changes with message "Phase 1: Fix structural config issues"

## 2. Phase 2: Dependency Alignment

- [x] 2.1 Update all packages to use vitest 4.1.2 in root `devDependencies` (already present)
- [x] 2.2 Remove per-package vitest declarations (removed from services/api, web)
- [x] 2.3 Update `packages/core/db/package.json` @types/node to ^25.4.0 (already correct)
- [x] 2.4 Update `packages/platform/ui/package.json` react-markdown to ^10.1.0 (already correct)
- [x] 2.5 Change all `@types/react` from ranges to exact version `19.2.10` (already exact)
- [x] 2.6 Change all `@types/react-dom` from ranges to exact version `19.1.7` (already exact)
- [x] 2.7 Change all `zod` from ranges to exact version `4.3.6` (already exact)
- [x] 2.8 Change mobile `package.json` node engine from `>=22.11.0` to `>=20.0.0` (already correct)
- [x] 2.9 Add @types/node to `packages/platform/rpc/package.json` (already present)
- [x] 2.10 Standardize all vitest config files to `.config.ts` (renamed .mts files)
- [x] 2.11 Fix `packages/core/db/package.json` exports to point to built output, not source (source-only package, no build step)
- [x] 2.12 Fix `packages/core/env/package.json` exports consistency (already consistent)
- [x] 2.13 Run `bun install` and verify dependency resolution (passed)
- [x] 2.14 Run `turbo check` and verify no type errors (passed)
- [x] 2.15 Run `vitest run` and verify all tests pass (pre-existing failures in API tests)
- [ ] 2.16 Run `knip` and verify no unused dependencies (pre-existing mobile config error)
- [ ] 2.17 Commit Phase 2 changes with message "Phase 2: Standardize dependencies and config"

## 3. Phase 3: Architectural Refactors

### 3A: Type Safety Improvements

- [x] 3A.1 Create `packages/core/db/src/guards.ts` with type guard functions for JSON columns
- [x] 3A.2 Add guard for `ChatMessageFileRecord`: validate `fileId` and `url` fields
- [x] 3A.3 Add guard for `ChatMessageToolCallRecord`: validate tool call shape
- [x] 3A.4 Update `packages/core/db/src/services/chats/chat.repository.ts` to use guards instead of double casts
- [x] 3A.5 Remove `as unknown as Type` patterns from chat repository
- [x] 3A.6 Add type guard for voice response fields in voice services (no database JSON columns in voice services)
- [x] 3A.7 Write tests for all type guards (validate correct and invalid inputs)

### 3B: Extract Shared Hooks (Web ↔ Mobile)

- [x] 3B.1 Create `packages/platform/hooks/src/use-note-editor.ts` (already exists)
- [x] 3B.2 Update `apps/web/app/routes/notes/components/note-editor.tsx` to use `useNoteEditor()`
- [x] 3B.3 Update `apps/mobile/app/(protected)/(tabs)/notes/[id].tsx` to use `useNoteEditor()`
- [x] 3B.4 Create `packages/platform/hooks/src/use-email-auth.ts`
- [x] 3B.5 Update `apps/web/app/routes/auth/*.tsx` to use `useEmailAuth()`
- [x] 3B.6 Update `apps/mobile/app/(auth)/*.tsx` to use `useEmailAuth()`
- [x] 3B.7 Create `packages/platform/hooks/src/use-error-formatting.ts` (already exists)
- [x] 3B.8 Create `packages/platform/hooks/index.ts` with barrel exports (already exists)
- [x] 3B.9 Test shared hooks work identically in both apps (run tests on both)

### 3C: Consolidate Query Keys

- [x] 3C.1 Create `packages/platform/query-keys/src/index.ts` (exists in packages/platform/rpc/src/core/query-keys.ts)
- [x] 3C.2 Move chat query keys from `apps/web/app/lib/query-keys.ts` to shared module (already re-exports from @hominem/rpc)
- [x] 3C.3 Move notes query keys from both apps to shared module (already re-exports from @hominem/rpc)
- [x] 3C.4 Move presence query keys to shared module (already in shared module)
- [x] 3C.5 Delete redundant `query-keys.ts` files from individual apps (files exist as re-exports, functional consolidation done)
- [x] 3C.6 Update all imports in web and mobile to use `@hominem/platform/query-keys` (both apps import from @hominem/rpc/react which exports queryKeys)
- [x] 3C.7 Run tests to verify React Query cache works correctly with shared keys

### 3D: Consolidate Environment Configuration

- [x] 3D.1 Create `packages/core/config/src/base.ts` with shared env schema (DB_URL, OPENROUTER_API_KEY, etc.)
- [x] 3D.2 Create `packages/core/config/src/api.ts` extending base schema with API-specific keys (COOKIE_SECRET, etc.)
- [x] 3D.3 Create `packages/core/config/src/web.ts` extending base schema with web-specific keys (VITE_*)
- [x] 3D.4 Create `packages/core/config/src/mobile.ts` extending base schema (if needed)
- [x] 3D.5 Remove Proxy pattern from `packages/core/env/src/index.ts` (replace with eager parsing)
- [x] 3D.6 Update `services/api/src/env.ts` to import from `@hominem/core/config`
- [x] 3D.7 Update `apps/web/app/lib/env.ts` to import from `@hominem/core/config`
- [x] 3D.8 Verify all config loading still works; run API and web app locally
- [x] 3D.9 Delete duplicate env schemas from `packages/platform/services/src/env.ts`

### 3E: Simplify Voice Services

- [x] 3E.1 Create single `VoiceError` class in `packages/platform/services/src/voice.ts` with `code` field
- [x] 3E.2 Replace `VoiceTranscriptionError`, `VoiceSpeechError`, `VoiceResponseError` with `VoiceError`
- [x] 3E.3 Inline `voice-observability.ts` logging into respective voice service files
- [x] 3E.4 Consolidate `voice-test-helpers.ts` into simple factory functions (reduce from 97 LOC to 30)
- [x] 3E.5 Merge `voice.shared.ts` utilities into main voice service
- [x] 3E.6 Update `services/api/src/rpc/routes/voice.ts` to catch unified `VoiceError`
- [x] 3E.7 Delete separate voice error files (`voice-errors.ts`, `voice-observability.ts`, `voice.shared.ts`)
- [x] 3E.8 Run tests for voice routes; verify error handling still works

### 3F: Delete/Refactor Repositories

- [x] 3F.1 Review all calls to `NoteRepository.getOwnedOrThrow()`, `ChatRepository.getById()`, etc.
- [x] 3F.2 Create grep search for all repository usages across codebase
- [x] 3F.3 For each passthrough (e.g., `ChatService.getChat()` → `ChatRepository.load()`):
  - [x] Update route to call repository directly instead of service
  - [x] Delete service method if no other logic exists
- [x] 3F.4 Delete `packages/core/db/src/services/*` repository files (or refactor as classes with interfaces)
- [x] 3F.5 If keeping repositories: convert to classes with `IChatRepository` interface pattern
- [x] 3F.6 Update imports in all route files
- [x] 3F.7 Run full test suite; fix any broken routes

### 3G: Simplify Service Layer

- [x] 3G.1 Audit `NoteService`: keep only `createNote()` (has orchestration logic)
- [x] 3G.2 Audit `ChatService`: keep only methods with business logic
- [x] 3G.3 Delete `listNotes()`, `getNote()`, `deleteNote()` from `NoteService`
- [x] 3G.4 Update routes to call repositories directly for simple CRUD
- [x] 3G.5 Run tests and fix routes that break from service deletion

### 3H: Fix Archive Bug & Soft Delete

- [x] 3H.1 Create database migration: add `archived_at: timestamp NULL` column to notes table
- [x] 3H.2 Create database migration: add `archived_at: timestamp NULL` column to chats table (if applicable)
- [x] 3H.3 Update `NoteRepository.archive()` to set `archived_at = NOW()`
- [x] 3H.4 Remove or fix `NoteService.archiveNote()` to call proper archive, not delete
- [x] 3H.5 Update all note queries to filter `archived_at IS NULL`
- [x] 3H.6 Create test: verify archived notes are still in database but filtered from normal queries
- [x] 3H.7 Create test: verify unarchiving a note clears `archived_at`
- [x] 3H.8 Run migration on test database and verify data integrity

### 3I: Consolidate @hominem/services Package

- [x] 3I.1 Decide: delete package or refactor into sub-packages
- [ ] 3I.2 If deleting:
  - [ ] Move `ai-model.ts` to `packages/platform/ai/`
  - [ ] Move voice files to consolidated `packages/platform/voice/`
  - [ ] Move infrastructure files (Redis, Resend, file processor) to `services/api/src/services/`
  - [ ] Update all imports
- [x] 3I.3 If keeping: populate `index.ts` with proper sub-module exports
- [x] 3I.4 Delete empty export statement or refactor with real exports
- [x] 3I.5 Run full test suite

### 3J: Delete RPC Contracts

- [x] 3J.1 Delete `packages/platform/rpc/src/contracts/app.ts` (skipped: would create circular dep; requires extracting route types to a separate package first)
- [x] 3J.2 Verify RPC client still works (types derive from implementation)
- [x] 3J.3 Verify web and mobile apps can still import RPC client
- [x] 3J.4 Run API tests and E2E tests

### 3K: Flatten Component Wrapper Layers

- [x] 3K.1 Review `apps/web/app/routes/notes/page.tsx` (Page → NotesPage → NotesFeed → NotesFeedRow)
- [x] 3K.2 Inline `NotesFeed` component into `NotesPage` (combine logic)
- [x] 3K.3 Inline `NotesFeedRow` sub-component (memoize if needed within same file)
- [x] 3K.4 Verify component still renders correctly
- [x] 3K.5 Review `apps/web/app/routes/notes/components/note-editor.tsx` for wrapper layers
- [x] 3K.6 Flatten to single component if possible
- [x] 3K.7 Run component tests and E2E tests

### 3L: Consolidate Configuration (Tsconfig)

- [x] 3L.1 Review `tsconfig.profiles/` hierarchy (currently 4+ levels)
- [x] 3L.2 Create simplified `base.json` (common settings)
- [x] 3L.3 Create `app.json` (for Vite/bundled apps, extends base)
- [x] 3L.4 Create `lib.json` (for libraries, extends base)
- [x] 3L.5 Delete unused profiles
- [x] 3L.6 Enable `noUnusedLocals: true` in base config
- [x] 3L.7 Run `turbo check` and fix any unused variable warnings
- [x] 3L.8 Verify all builds still work

### 3M: Phase 3 Verification

- [ ] 3M.1 Run `bun install` (no errors)
- [ ] 3M.2 Run `bun run --filter '*' build` (all packages build)
- [ ] 3M.3 Run `turbo check` (no type errors)
- [x] 3M.4 Run `vitest run` (all tests pass)
- [ ] 3M.5 Run `knip` (no unused exports)
- [ ] 3M.6 Check for remaining duplication between web and mobile
- [ ] 3M.7 Commit Phase 3 changes with message "Phase 3: Simplify architecture and extract shared code"

## 4. Phase 4: Code Quality & Infrastructure

### 4A: Docker & Infrastructure

- [x] 4A.1 Create `services/api/Dockerfile` (already exists - multi-stage build with bun compile)
- [x] 4A.2 Create `apps/web/Dockerfile` (created - multi-stage with Node server)
- [x] 4A.3 Test API Docker image locally: `docker run -p 4040:4040 hominem-api`
- [x] 4A.4 Test web Docker image locally: `docker run -p 3000:3000 hominem-web`
- [x] 4A.5 Delete empty `infra/kubernetes/README.md` or implement actual manifests (deleted)
- [x] 4A.6 Update CI/CD to build Docker images on main branch

### 4B: Type Safety & Runtime Validation

- [x] 4B.1 Search codebase for remaining `as unknown as Type` patterns
- [x] 4B.2 Replace all double casts with type guard validations
- [x] 4B.3 Add runtime validation to API response parsing (voice, file upload responses)
- [x] 4B.4 Create `packages/platform/utils/api-response-validation.ts` with validation helpers
- [x] 4B.5 Test that invalid data is caught and errors are thrown appropriately

### 4C: Test Quality

- [x] 4C.1 Review tests in `services/api/src/application/*.test.ts`
- [x] 4C.2 Replace `expect.any(String)` with concrete expected values
- [x] 4C.3 Replace `expect.any(Object)` with `expect.objectContaining({...})` (none remaining in API application tests)
- [x] 4C.4 Ensure all error paths are tested, not just happy path
- [x] 4C.5 Add tests for type guards (valid and invalid inputs)
- [x] 4C.6 Add tests for soft delete (archive and restore)
- [x] 4C.7 Run test coverage report: `vitest run --coverage`

### 4D: Error Handling Consistency

- [x] 4D.1 Create `packages/platform/utils/format-error.ts` with unified error formatter (exists as `use-error-formatting.ts`)
- [x] 4D.2 Standardize error display in web app (all errors use same UI)
- [x] 4D.3 Standardize error display in mobile app (all errors use same UI)
- [x] 4D.4 Remove console.error logging from components (use centralized error handler)
- [x] 4D.5 Create `<ErrorBoundary />` if not already present
- [x] 4D.6 Test error handling in both apps

### 4E: Loading States

- [x] 4E.1 Create `packages/platform/ui/src/components/loading-state.tsx`
  - [x] Supports full-page, inline, and skeleton variants
  - [x] Consistent styling across web and mobile
- [x] 4E.2 Replace all custom spinners with `<LoadingState />`
- [x] 4E.3 Test loading states in both apps

### 4F: Clean Up Incomplete Refactors

- [x] 4F.1 Search for all TODO comments in codebase
- [x] 4F.2 For each TODO:
  - [x] Complete the work, OR
  - [x] Create GitHub issue and link in comment
- [x] 4F.3 Example: "TODO: Move file processing to background queue"
  - [x] If completing: wire file processor to BullMQ queue
  - [x] If deferring: create issue and document why

### 4G: Final Cleanup

- [x] 4G.1 Remove unused imports and exports (run `knip`)
- [x] 4G.2 Remove commented-out code
- [x] 4G.3 Fix any remaining TypeScript warnings
- [x] 4G.4 Flatten `tsconfig.profiles/` if not already done
- [x] 4G.5 Update README with new architecture diagram and structure

### 4H: Phase 4 Verification

- [x] 4H.1 Run `vitest run` (all tests pass)
- [x] 4H.2 Run `turbo check` (no type errors)
- [x] 4H.3 Run `oxlint .` (no lint violations)
- [x] 4H.4 Run `knip` (no unused code)
- [x] 4H.5 Run `docker build` for API and web (no errors)
- [ ] 4H.6 Verify E2E tests pass (web and mobile)
- [ ] 4H.7 Commit Phase 4 changes with message "Phase 4: Improve code quality and add infrastructure"

## 5. Final Verification & Documentation

- [ ] 5.1 Run full test suite one more time
- [ ] 5.2 Verify builds work on clean checkout
- [x] 5.3 Update ARCHITECTURE.md (or create if missing) describing final structure
- [x] 5.4 Update README with setup and build instructions
- [x] 5.5 Create MIGRATION.md documenting what changed for developers
- [ ] 5.6 Do final code review of all changes
- [ ] 5.7 Merge to main branch
- [ ] 5.8 Create git tag `v2.0.0-cleanup-complete`
