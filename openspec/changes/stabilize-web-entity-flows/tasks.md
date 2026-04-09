## 1. Canonical Note Creation

- [x] 1.1 Audit the `/notes` create flow and document every place optimistic note state currently defines success or rollback behavior
- [x] 1.2 Refactor web note creation so successful create resolves against the canonical note ID returned by the API
- [x] 1.3 Navigate to `/notes/:id` as the primary success path for note creation from the notes index
- [x] 1.4 Ensure failed note creation rolls back optimistic client state without waiting on animation completion
- [x] 1.5 Add targeted web tests for canonical note creation success, rollback, and duplicate-title edge cases

## 2. Direct Upload Contract

- [x] 2.1 Audit the current test-mode upload path and identify every place it diverges from the production direct upload contract
- [ ] 2.2 Refactor test-mode storage so `prepare-upload -> upload bytes -> complete-upload` uses the same browser-facing protocol shape as production
- [ ] 2.3 Update upload completion semantics so `done` means canonical file completion, not local progress only
- [ ] 2.4 Remove or replace hidden test-only upload protocol drift that bypasses the canonical direct upload lifecycle
- [ ] 2.5 Add integration coverage for the real direct upload seam: `prepare-upload`, upload bytes to the returned target, and `complete-upload`

## 3. Client Boundary Validation

- [ ] 3.1 Add runtime response validation for web note creation responses at the RPC/client boundary
- [ ] 3.2 Add runtime response validation for file upload prepare/complete responses at the RPC/client boundary
- [ ] 3.3 Ensure invalid note or upload responses fail with actionable diagnostics instead of silent UI drift

## 4. Web E2E Stabilization

- [ ] 4.1 Update note-creation Playwright helpers/specs to synchronize on canonical note routes and editor readiness
- [ ] 4.2 Update upload Playwright helpers/specs to synchronize on domain-complete upload states and persisted attachments after reload
- [ ] 4.3 Add lower-level integration tests for canonical note creation and direct upload lifecycle so protocol drift is caught before Playwright
- [ ] 4.4 Improve E2E helper failure messages to distinguish route convergence failures, upload completion failures, and optimistic-feed timing artifacts

## 5. Verification

- [ ] 5.1 Run targeted web unit and route tests covering note creation and upload flows
- [ ] 5.2 Run targeted API/integration tests for notes and files lifecycle contracts
- [ ] 5.3 Run `bun run --filter @hominem/web typecheck` and `bun run --filter @hominem/api typecheck`
- [ ] 5.4 Run the failing Playwright specs for notes and chat attachments until they pass consistently
