## Why

E2E tests for file upload functionality are flaky due to implicit asynchronous chains with no observable state transitions. Tests race against 7-step async operations (lazy module loading, S3 upload, completion API calls) with only DOM polling as a synchronization mechanism. This violates the architectural principle that every async operation must have explicit, observable state.

## What Changes

- **Introduce Upload State Machine**: Define explicit states (idle → preparing → uploading → completing → done/error) with data attributes rendered to DOM for test observability
- **Architectural Honesty for Test Storage**: Remove Proxy pattern hiding test-only methods; expose `__testOnlyStoreFile` as explicit, typed interface
- **Pre-load Uppy in Test Mode**: Eliminate non-deterministic initialization by eagerly loading upload modules when `NODE_ENV === 'test'`
- **Remove Unused Test Endpoint**: Delete `/test/upload/:filePath*` route that creates test mode fragmentation
- **Update Test Assertions**: Migrate from polling DOM elements to waiting for explicit state transitions via `data-upload-state` attributes

## Capabilities

### New Capabilities
- `upload-state-machine`: Observable state transitions for file upload operations with explicit state machine and DOM-rendered status attributes
- `test-storage-interface`: Explicit test-only storage methods with proper typing and architectural honesty

### Modified Capabilities
- `file-upload`: UI components render upload state via data attributes for test observability; handle state machine transitions

## Impact

- **apps/web**: `useFileUpload` hook, chat and note editor components, E2E test files
- **packages/core/utils**: `R2StorageService` and `InMemoryStorageBackend` classes
- **services/api**: Files route (removing test endpoint)
- **E2E Test Suite**: All file attachment tests become deterministic

## Success Criteria

- File upload E2E tests pass consistently (0 flakes over 50 runs)
- No `waitForTimeout` or arbitrary delays in upload tests
- Type-safe test storage interface with no `as any` casting
- Upload state visible in DOM for debugging
