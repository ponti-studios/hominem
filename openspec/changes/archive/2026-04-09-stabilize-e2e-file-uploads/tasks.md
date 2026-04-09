## 1. Type Definitions and Setup

- [x] 1.1 Create `UploadState` union type: `'idle' | 'preparing' | 'uploading' | 'completing' | 'done' | 'error'`
- [x] 1.2 Update `UploadState` interface to include state field and transition methods
- [x] 1.3 Define `TestStorageService` interface with `__testOnlyStoreFile` method
- [x] 1.4 Add `isTestMode` constant export from `@hominem/utils/storage`

## 2. Upload State Machine Implementation

- [x] 2.1 Refactor `useFileUpload` hook to use state machine instead of boolean flags
- [x] 2.2 Implement state transition logic: `idle` → `preparing` → `uploading` → `completing` → `done`
- [x] 2.3 Add error state transitions from any non-terminal state
- [x] 2.4 Add pre-load initialization for Uppy modules in test mode
- [x] 2.5 Ensure atomic state transitions (no race conditions)

## 3. DOM Observability

- [x] 3.1 Add `data-upload-state` attribute to upload container in chat component
- [x] 3.2 Add `data-upload-state` attribute to upload container in note editor component
- [x] 3.3 Add `data-upload-progress` attribute to both components
- [x] 3.4 Ensure attributes update synchronously with state changes
- [x] 3.5 Verify attributes are present in DOM for test inspection

## 4. Test Storage Interface

- [x] 4.1 Add `__testOnlyStoreFile` method to `InMemoryStorageBackend` class
- [x] 4.2 Update storage service exports to expose test interface
- [x] 4.3 Add `NODE_ENV === 'test'` guard for test-only methods
- [x] 4.4 Remove Proxy pattern from `R2StorageService` constructor
- [x] 4.5 Update type definitions to remove need for `as any` casting

## 5. API Route Cleanup

- [x] 5.1 Remove `/test/upload/:filePath*` endpoint from files route
- [x] 5.2 Remove `TestStorageService` interface from files route (if not used elsewhere)
- [x] 5.3 Update tests that may reference the removed endpoint
- [x] 5.4 Verify API routes still pass lint and typecheck

## 6. E2E Test Updates

- [x] 6.1 Update `attachChatFile` helper to wait for `data-upload-state="done"`
- [x] 6.2 Update `attachNoteFile` helper to wait for `data-upload-state="done"`
- [x] 6.3 Remove arbitrary timeouts from upload tests
- [x] 6.4 Add assertions for `data-upload-progress` in upload tests
- [x] 6.5 Verify tests pass consistently (run 10 times locally)

## 7. Component Updates

- [x] 7.1 Update `chat.$chatId.tsx` to render upload state attributes
- [x] 7.2 Update `note-editor.tsx` to render upload state attributes
- [x] 7.3 Ensure both components import updated `useFileUpload` hook
- [x] 7.4 Verify components handle all state machine transitions correctly
- [x] 7.5 Test components render correctly in all upload states

## 8. Verification and Cleanup

- [x] 8.1 Run full test suite: `bunx turbo run test`
- [x] 8.2 Run E2E tests 50 times in CI to verify stability
- [x] 8.3 Remove any remaining `as any` casts in upload-related code
- [x] 8.4 Verify no lint errors in changed files
- [x] 8.5 Verify no TypeScript errors in changed files
- [x] 8.6 Document new testing patterns in README or testing guide
