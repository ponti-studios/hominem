## Context

The current web note and upload flows fail for the same structural reason: the UI is allowed to treat transitional local state as if it were canonical system state. Note creation on `/notes` depends on optimistic feed rows, cache replacement, reversed infinite-query display order, and virtualization before the user ever lands on a canonical note route. Direct uploads in test mode depend on storage behavior that diverges from the production `prepare-upload -> upload bytes -> complete-upload` protocol, which means the browser-facing contract is not actually stable across environments.

The result is a brittle test surface. Playwright is forced to synchronize on incidental DOM timing, title-matched feed rows, and upload state that may not correspond to a persisted file. Route tests and API tests cover pieces of the system, but the exact seams that fail in CI are not represented as explicit contracts.

## Goals / Non-Goals

**Goals:**
- Make note creation converge on a canonical note ID and route before any feed refresh concerns.
- Make direct uploads preserve one protocol shape in production and test environments.
- Define stable domain-level synchronization points for web E2E tests.
- Add lower-level integration coverage so protocol drift is caught before Playwright.
- Improve diagnostics by validating note and upload API responses at the client boundary.

**Non-Goals:**
- Redesigning the visual appearance of notes, chat, or attachment UI.
- Replacing React Query, Uppy, or Playwright.
- Adding end-user progress UI beyond what is needed for canonical state observability.
- Refactoring unrelated note editing, chat rendering, or authentication behavior.

## Decisions

### 1. Note creation success is defined by canonical navigation
**Decision:** Treat note creation as successful only when the client has a canonical note ID and can navigate to `/notes/:id`.

**Rationale:**
- The system already has a canonical note route and editor flow.
- Entity creation is more stable when success is defined by persisted identity, not feed-cache decoration.
- Playwright can reliably synchronize on route changes and note editor readiness.

**Alternatives considered:**
- Keep optimistic feed rows as the primary success path. Rejected because it couples correctness to cache replacement timing, list ordering, and duplicate row identity.
- Remove all optimistic UI everywhere. Rejected because cosmetic optimism may still be acceptable, but it must not own correctness.

### 2. Optimistic feed state is decorative, not authoritative
**Decision:** If the feed retains optimistic note rows, they SHALL be treated as non-canonical decoration that cannot block rollback, navigation, or canonical rendering.

**Rationale:**
- This preserves optional responsiveness without allowing local illusion to define success.
- Error handling becomes data-driven instead of animation-driven.
- Duplicate title matches in the feed no longer threaten route-level correctness.

**Alternatives considered:**
- Continue surgical optimistic replacement as the primary reconciliation strategy. Rejected because it is too easy for canonical and optimistic rows to coexist or diverge.

### 3. Direct upload protocol must be environment-independent
**Decision:** Preserve one browser-facing protocol in all environments: `prepare-upload -> upload bytes -> complete-upload`.

**Rationale:**
- Test mode should swap the storage adapter, not the upload contract.
- This removes the contradiction where the spec removes a test endpoint while the runtime still depends on it.
- It enables meaningful integration tests below the Playwright layer.

**Alternatives considered:**
- Reintroduce a test-only upload HTTP shortcut as a separate protocol. Rejected because it recreates hidden drift between production and test behavior.
- Make the client branch on test mode and bypass direct upload. Rejected because it teaches the browser a different protocol than production.

### 4. Upload state `done` means persisted canonical completion
**Decision:** The `done` state SHALL mean the upload bytes were accepted through the direct upload contract and the completion step returned a canonical uploaded file record.

**Rationale:**
- Tests waiting on `data-upload-state="done"` should be waiting on domain truth, not just local progress.
- This aligns the upload state machine with actual file persistence semantics.

**Alternatives considered:**
- Keep `done` as a local-client milestone before canonical completion. Rejected because tests and users both interpret `done` as real completion.

### 5. Add a contract-testing seam below Playwright
**Decision:** Add integration coverage for canonical note creation and direct upload lifecycle using the real app/server boundary but without the browser UI.

**Rationale:**
- The current pyramid jumps from unit tests to Playwright, leaving the failing protocol seams untested.
- Integration tests can validate route contracts, upload URLs, and completion semantics cheaply and deterministically.

**Alternatives considered:**
- Rely on Playwright only. Rejected because full-browser failures are expensive and opaque.

### 6. Runtime response validation at RPC boundaries
**Decision:** Validate note creation and file upload response payloads where web clients consume them.

**Rationale:**
- Invalid or partial API payloads should fail loudly at the boundary.
- This fits the existing cleanup direction already identified in `hominem-monorepo-cleanup` task 4B.3.

**Alternatives considered:**
- Continue trusting `res.json()` payload shapes implicitly. Rejected because it hides protocol drift until UI state becomes inconsistent.

## Risks / Trade-offs

**[Risk]** Canonical-note navigation may feel less instantaneous than optimistic feed insertion.
→ **Mitigation:** Keep optimism only as decoration if desired, but define success and tests around canonical navigation.

**[Risk]** Preserving one upload protocol across environments may require a slightly richer in-memory test storage adapter.
→ **Mitigation:** Limit the adapter work to the direct upload lifecycle rather than refactoring the entire storage subsystem.

**[Risk]** Additional integration tests increase maintenance surface.
→ **Mitigation:** Keep them focused on protocol seams that historically break: note creation and direct upload completion.

**[Risk]** Response validation may reveal existing malformed payload assumptions.
→ **Mitigation:** Roll it out first on the unstable note and upload flows, where the diagnostic value is highest.

## Migration Plan

1. Define canonical requirements in specs for note creation, direct uploads, and E2E synchronization.
2. Align upload-state and test-storage specs with the single-protocol model.
3. Update note creation flow so canonical route convergence is the success path.
4. Update test-mode storage and upload completion flow to preserve the same upload protocol shape as production.
5. Add integration tests for canonical note creation and direct upload lifecycle.
6. Update Playwright helpers/specs to wait on canonical routes, persisted attachments, and domain-complete upload states.
7. Roll back by reverting the change; no data migration is required.

## Open Questions

1. Should the `/notes` page still render an optimistic feed row while awaiting canonical note creation, or should it switch to explicit pending UI only?
2. Should the test upload target be served by the API process as a storage adapter surface, or by a separate in-memory storage harness behind the same contract?
3. How broadly should runtime response validation be introduced beyond notes and file uploads in this change?
