## Context

The current web note and upload flows fail for the same structural reason: the UI is allowed to treat transitional local state as if it were canonical system state. Note creation on `/notes` depends on optimistic feed rows, cache replacement, reversed infinite-query display order, and virtualization before the user ever lands on a canonical note route. File uploads currently split browser success across `prepare-upload`, byte transfer, and `complete-upload`, which creates extra protocol surface, test-specific coordination problems, and a mismatch between local progress and persisted file truth.

The result is a brittle test surface. Playwright is forced to synchronize on incidental DOM timing, title-matched feed rows, and upload state that may not correspond to a persisted file. Route tests and API tests cover pieces of the system, but the exact seams that fail in CI are not represented as explicit contracts.

## Goals / Non-Goals

**Goals:**
- Make note creation converge on a canonical note ID and route before any feed refresh concerns.
- Replace the multi-step upload protocol with one canonical browser-to-API upload contract in all environments.
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

### 3. File upload contract is a single canonical HTTP request
**Decision:** Replace the multi-step direct upload lifecycle with one browser-facing HTTP upload request handled through `XHRUpload`, and define success by the canonical file record returned from that request.

**Rationale:**
- The current attachment workload is small enough that server-handled uploads are simpler than maintaining a split prepare/upload/complete protocol.
- This collapses browser upload success and canonical file persistence into one step.
- Test and production environments naturally share the same browser-facing contract.
- Uppy can own upload mechanics without the client re-implementing a separate completion phase.

**Alternatives considered:**
- Preserve `prepare-upload -> upload bytes -> complete-upload` with a test adapter. Rejected because it adds coordination complexity disproportionate to the current attachment size and scale.
- Make the client branch on test mode and bypass direct upload. Rejected because it teaches the browser a different protocol than production.

### 4. Upload state `done` means persisted canonical completion
**Decision:** The `done` state SHALL mean the upload request completed successfully and returned a canonical uploaded file record.

**Rationale:**
- Tests waiting on `data-upload-state="done"` should be waiting on domain truth, not just local progress.
- This aligns the upload state machine with actual file persistence semantics.

**Alternatives considered:**
- Keep `done` as a local-client milestone before canonical completion. Rejected because tests and users both interpret `done` as real completion.

### 5. Add a contract-testing seam below Playwright
**Decision:** Add integration coverage for canonical note creation and canonical file upload lifecycle using the real app/server boundary but without the browser UI.

**Rationale:**
- The current pyramid jumps from unit tests to Playwright, leaving the failing protocol seams untested.
- Integration tests can validate upload request contracts and canonical persistence semantics cheaply and deterministically.

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

**[Risk]** Server-handled uploads increase API responsibility for attachment bytes.
→ **Mitigation:** Keep the scope limited to current small attachment sizes and revisit direct-to-storage only if workload or cost justifies it.

**[Risk]** Additional integration tests increase maintenance surface.
→ **Mitigation:** Keep them focused on protocol seams that historically break: note creation and direct upload completion.

**[Risk]** Response validation may reveal existing malformed payload assumptions.
→ **Mitigation:** Roll it out first on the unstable note and upload flows, where the diagnostic value is highest.

## Migration Plan

1. Define canonical requirements in specs for note creation, canonical uploads, and E2E synchronization.
2. Align upload-state and test-storage specs with the single-request upload model.
3. Update note creation flow so canonical route convergence is the success path.
4. Replace multi-step file upload logic with one canonical `XHRUpload` request path that returns the persisted file record.
5. Add integration tests for canonical note creation and canonical upload lifecycle.
6. Update Playwright helpers/specs to wait on canonical routes, persisted attachments, and domain-complete upload states.
7. Roll back by reverting the change; no data migration is required.

## Open Questions

1. Should the `/notes` page still render an optimistic feed row while awaiting canonical note creation, or should it switch to explicit pending UI only?
2. Should the upload endpoint be note/chat agnostic and return the canonical file record directly, or should it preserve separate endpoints per product surface?
3. How broadly should runtime response validation be introduced beyond notes and file uploads in this change?
