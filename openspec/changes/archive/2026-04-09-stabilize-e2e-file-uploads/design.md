## Context

Current file upload implementation uses implicit async chains with no observable state:

```
User selects file
    ↓
onChange fires → Lazy load Uppy → Init S3 plugin → Upload bytes
    ↓                                        ↓
    └─────────── No loading UI ─────────────┘
                                          ↓
                              upload-success event
                                          ↓
                              completeUpload API call
                                          ↓
                              setAttachedFiles state update
                                          ↓
                              React re-render
```

Tests must poll for DOM elements (like filename buttons) to detect completion. This creates race conditions because:
1. First upload triggers lazy module loading (network + eval time)
2. Module initialization is non-deterministic
3. No explicit signal when upload chain completes
4. Test retries get cached modules (different timing)

Current test storage uses Proxy pattern hiding test-only capabilities:
```ts
class InMemoryStorageBackend {
  storeFileWithExactKey() { }  // Test-only, not in interface
}

// Production code uses this, but tests cast to access test method:
(fileStorageService as any).storeFileWithExactKey(...)
```

## Goals / Non-Goals

**Goals:**
- Eliminate flaky file upload E2E tests through explicit state observability
- Define type-safe upload state machine with 5 states (idle, preparing, uploading, completing, done/error)
- Render upload state to DOM via data attributes for test synchronization
- Expose test storage capabilities through explicit interface (not Proxy casting)
- Pre-load upload modules in test mode for deterministic timing

**Non-Goals:**
- Changing production S3 upload behavior or performance
- Adding user-facing upload progress UI (though data attributes enable this later)
- Refactoring entire storage layer (targeted changes only)
- Supporting multipart uploads (out of scope)

## Decisions

### 1. State Machine Over Callbacks
**Decision:** Use explicit state machine instead of boolean flags (`isUploading`, `progress`).

**Rationale:**
- Single source of truth for upload lifecycle
- Enables testing: `await expect(uploadState).toBe('done')`
- Prevents invalid state combinations (can't be `uploading` and `error` simultaneously)
- Self-documenting: state names describe what's happening

**Alternative considered:** Boolean flags with derived state. Rejected because scattered state is harder to test and reason about.

### 2. Data Attributes for DOM Observability
**Decision:** Render `data-upload-state` and `data-upload-progress` attributes on container elements.

**Rationale:**
- Tests can wait for state transitions: `[data-upload-state="done"]`
- Debugging: Inspect element shows current state
- Framework agnostic: Works with React, Vue, or vanilla JS
- Minimal DOM pollution: Single attribute vs wrapper elements

**Alternative considered:** Custom events (`window.dispatchEvent`). Rejected because events are ephemeral - tests might miss them. DOM attributes are persistent state.

### 3. Explicit Test Interface
**Decision:** Add `__testOnlyStoreFile` method to storage interface, guarded by `NODE_ENV === 'test'`.

**Rationale:**
- Type-safe: No `as any` casting
- Self-documenting: Method name clearly indicates test-only
- Conditional: Won't exist in production builds (dead code elimination)
- Audit trail: Easy to find test-only code

**Alternative considered:** Keep Proxy pattern. Rejected because it hides architectural intent and prevents type checking.

### 4. Pre-load in Test Mode
**Decision:** Eagerly load Uppy modules when `NODE_ENV === 'test'` during hook initialization.

**Rationale:**
- Eliminates timing difference between first and subsequent uploads
- No production bundle size impact (test mode only)
- Simple implementation: `useEffect(() => { if (isTestMode) loadUppyModules() }, [])`

**Alternative considered:** Module side-effect at import time. Rejected because it affects production bundle size.

### 5. Remove Test Upload Endpoint
**Decision:** Delete `/test/upload/:filePath*` route entirely.

**Rationale:**
- Unused by current E2E tests (they use browser upload flow)
- Creates architectural confusion (two test paths)
- Less code to maintain
- Can be restored if needed for specific test scenarios

**Alternative considered:** Keep for potential future use. Rejected because YAGNI - we can add it back if needed.

## Risks / Trade-offs

**[Risk]** State machine adds complexity for simple uploads
→ **Mitigation:** Only 5 states, well-defined transitions. Simpler than scattered boolean flags.

**[Risk]** Data attributes clutter DOM
→ **Mitigation:** Only 2 attributes (`data-upload-state`, `data-upload-progress`). Can be stripped in production if needed.

**[Risk]** Pre-loading increases test memory usage
→ **Mitigation:** Uppy modules load anyway on first upload. Just shifts timing.

**[Risk]** Test-only interface could leak to production
→ **Mitigation:** Method prefixed with `__testOnly`, guarded by env check. Tree-shaking removes in production.

**[Risk]** Breaking change for existing tests
→ **Mitigation:** Gradual migration - old polling still works, new state assertions optional.

## Migration Plan

1. **Phase 1: Infrastructure**
   - Add state machine types and logic to `useFileUpload`
   - Add data attributes to upload components
   - Remove test endpoint

2. **Phase 2: Storage Interface**
   - Add `__testOnlyStoreFile` to storage interface
   - Update test storage implementation
   - Remove Proxy pattern

3. **Phase 3: Test Updates**
   - Update E2E tests to use state assertions
   - Add pre-load initialization
   - Verify stability (50 runs, 0 flakes)

4. **Phase 4: Cleanup**
   - Remove any remaining `as any` casts
   - Document new testing patterns

**Rollback:** Revert commits. No database migrations or API changes.

## Open Questions

1. Should we expose upload state to users via progress UI? (Future enhancement)
2. Do we need intermediate states like `validating` for file type checks?
3. Should upload state be global (context) or local (hook)? Currently leaning local.
