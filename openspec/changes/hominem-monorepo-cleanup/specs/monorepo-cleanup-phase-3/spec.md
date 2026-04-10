## ADDED Requirements

### Requirement: Type guards validate JSON column data
The database layer SHALL validate JSON data from Postgres JSONB columns using runtime type guards, not double casts. String and array types SHALL be validated against their expected shape before use.

#### Scenario: Chat message files are validated
- **WHEN** loading a chat message from the database
- **THEN** the `files` field is validated to be an array of `ChatMessageFileRecord` objects; if validation fails, an error is thrown

### Requirement: Repositories are deleted or refactored with interfaces
Static object repositories without interfaces (NoteRepository, ChatRepository, FileRepository) SHALL either be deleted entirely or refactored as classes with interfaces to enable testing and mocking.

#### Scenario: Repository pattern is removed or testable
- **WHEN** writing tests for database operations
- **THEN** either repositories are replaced with direct Kysely calls, or repositories are injectable classes with interfaces

### Requirement: Service layer contains only orchestration logic
Service classes (NoteService, ChatService) SHALL contain only methods with business logic or orchestration (e.g., `createNote` derives title, syncs files). Passthrough methods that only delegate to repositories SHALL be deleted.

#### Scenario: Services are not passthroughs
- **WHEN** reviewing `NoteService` methods
- **THEN** each method does real work (orchestration, validation, etc.); purely delegating methods are deleted

### Requirement: @hominem/services package is consolidated
The `@hominem/services` package (currently exporting empty object) SHALL either be populated with meaningful exports or deleted. If kept, its `index.ts` SHALL re-export focused sub-modules (AI, voice, infrastructure).

#### Scenario: Services package has clear boundaries
- **WHEN** importing from `@hominem/services`
- **THEN** either the package is deleted and imports point to new locations, or `index.ts` exports clear sub-modules

### Requirement: Voice services are consolidated
Supporting files for voice services (`voice-errors.ts`, `voice-observability.ts`, `voice.shared.ts`, `voice-test-helpers.ts`) SHALL be consolidated. Error classes SHALL be replaced with a single `VoiceError` class with a `code` field.

#### Scenario: Voice service errors are unified
- **WHEN** catching voice service errors
- **THEN** a single `VoiceError` with `code` and `context` fields is thrown (no separate VoiceTranscriptionError, VoiceSpeechError, etc.)

### Requirement: Shared hooks are extracted between web and mobile
Logic duplicated between `apps/web` and `apps/mobile` (note editor, auth flows) SHALL be extracted to `packages/platform/hooks/` as custom hooks that return platform-agnostic logic and state.

#### Scenario: Note editor logic is shared
- **WHEN** implementing note editing in both web and mobile
- **THEN** both apps import `useNoteEditor()` from `@hominem/platform/hooks`; the hook returns `{ title, setTitle, content, setContent, debouncedSave }`

### Requirement: Query keys are centralized
React Query keys currently defined separately in `apps/web/app/lib/query-keys.ts` and `apps/mobile/lib/services/*/query-keys.ts` SHALL be consolidated to `packages/platform/query-keys/src/index.ts` as the single source of truth.

#### Scenario: Query keys are centralized and reused
- **WHEN** both apps need chat query keys
- **THEN** both import from `@hominem/platform/query-keys`

### Requirement: Environment configuration is consolidated
Env validation schemas currently defined separately in core/env, services/api, platform/services, and apps/web SHALL be consolidated to `packages/core/config` with a base schema and layer-specific extensions.

#### Scenario: Environment variables are validated centrally
- **WHEN** instantiating the API or web app
- **THEN** configuration is loaded from a single `@hominem/core/config` module with shared + layer-specific schemas

### Requirement: Archive operation performs soft delete
The `archiveNote()` operation SHALL set `archived_at` timestamp (soft delete), not call `deleteNote()` (hard delete). Archived notes SHALL be filtered from normal queries.

#### Scenario: Archive is recoverable
- **WHEN** user archives a note
- **THEN** the note's `archived_at` field is set, but data remains in the database and can be recovered

### Requirement: RPC contracts are deleted
The `packages/platform/rpc/src/contracts/app.ts` stub file (with dummy `Response(null)` handlers) SHALL be deleted. The Hono RPC client SHALL derive types from the actual implementation in `services/api/src/rpc/app.ts`.

#### Scenario: Contract implementation stays in sync
- **WHEN** adding new routes to the API
- **THEN** no separate contract file needs updating; types are derived from implementation

### Requirement: Component wrapper layers are flattened
Multi-level component nesting where each level only passes props through (e.g., Page → NotesPage → NotesFeed → NotesFeedRow) SHALL be flattened to 2 levels or fewer.

#### Scenario: Component nesting is minimal
- **WHEN** reading `apps/web/app/routes/notes/page.tsx`
- **THEN** the component structure is direct, with no unnecessary wrapper layers

### Requirement: Phase 3 verification passes
After completing Phase 3 architectural refactors, the full test suite and type checks SHALL pass, with no duplication between web and mobile.

#### Scenario: Architecture changes are stable
- **WHEN** running `vitest run`, `turbo check`, and checking for duplication
- **THEN** all tests pass, types are correct, and major duplication is eliminated
