## 1. Canonical Note Creation

- [x] 1.1 Audit the `/notes` create flow and document every place optimistic note state currently defines success or rollback behavior
- [x] 1.2 Refactor web note creation so successful create resolves against the canonical note ID returned by the API
- [x] 1.3 Navigate to `/notes/:id` as the primary success path for note creation from the notes index
- [x] 1.4 Ensure failed note creation rolls back optimistic client state without waiting on animation completion
- [x] 1.5 Add targeted web tests for canonical note creation success, rollback, and duplicate-title edge cases

## 2. Canonical Upload Contract

- [x] 2.1 Audit the current multi-step upload path and identify every place browser success depends on non-canonical intermediate state
- [x] 2.2 Replace `prepare-upload -> upload bytes -> complete-upload` with one canonical `XHRUpload` request that returns the persisted file record
- [x] 2.3 Update upload state semantics so `done` means the canonical upload request succeeded, not local progress only
- [x] 2.4 Remove hidden test-only upload protocol drift and test-mode browser branching from the upload flow
- [x] 2.5 Add integration coverage for the real upload seam: browser-equivalent HTTP upload request in, canonical file record out

## 3. Client Boundary Validation

- [x] 3.1 Add runtime response validation for web note creation responses at the RPC/client boundary
- [x] 3.2 Add runtime response validation for canonical file upload responses at the RPC/client boundary
- [x] 3.3 Ensure invalid note or upload responses fail with actionable diagnostics instead of silent UI drift

## 4. Web E2E Stabilization

- [x] 4.1 Update note-creation Playwright helpers/specs to synchronize on canonical note routes and editor readiness
- [x] 4.2 Update upload Playwright helpers/specs to synchronize on domain-complete upload states and persisted attachments after reload
- [x] 4.3 Add lower-level integration tests for canonical note creation and canonical upload lifecycle so protocol drift is caught before Playwright
- [x] 4.4 Improve E2E helper failure messages to distinguish route convergence failures, upload completion failures, and optimistic-feed timing artifacts

## 5. Verification

- [x] 5.1 Run targeted web unit and route tests covering note creation and upload flows
- [x] 5.2 Run targeted API/integration tests for notes and files lifecycle contracts
- [x] 5.3 Run `bun run --filter @hominem/web typecheck` and `bun run --filter @hominem/api typecheck`
- [x] 5.4 Run the failing Playwright specs for notes and chat attachments until they pass consistently
