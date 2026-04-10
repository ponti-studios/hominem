## Why

Web note creation and file attachment flows are failing in CI because the system relies on optimistic UI and multi-step upload coordination instead of converging on canonical entity state. We need one stable contract for note creation, one stable contract for canonical file uploads, and E2E tests that synchronize against domain truth instead of incidental DOM timing.

## What Changes

- Make note creation converge on canonical note IDs and note detail routes instead of treating optimistic feed rows as the primary success path.
- Replace the multi-step direct-upload lifecycle with a single canonical HTTP upload contract using `XHRUpload`, so browser upload success and canonical file persistence converge in one request.
- Establish web E2E contracts around canonical route transitions, persisted attachments, and explicit domain-level synchronization points.
- Add targeted integration coverage and runtime response validation for note creation and canonical upload flows so protocol drift is caught before Playwright.

## Capabilities

### New Capabilities
- `canonical-note-creation`: Canonical note creation behavior for web flows, including success, error, and navigation semantics.
- `direct-upload-contract`: A stable canonical upload lifecycle built around one HTTP upload request that returns a persisted file record.
- `web-e2e-contracts`: Stable domain-level synchronization rules and intermediate integration seams for critical web E2E flows.

### Modified Capabilities
- `upload-state-machine`: Refine upload state semantics so `done` reflects a successfully completed canonical upload request rather than local UI progress alone.
- `test-storage-interface`: Remove browser-facing test storage protocol concerns from the upload contract so test storage remains an internal blob persistence concern.

## Impact

- **apps/web**: `use-notes`, `use-file-upload`, notes and chat routes, route tests, and Playwright helpers/specs.
- **packages/platform/rpc**: API response parsing and runtime validation for note and file mutations.
- **packages/core/utils**: Storage surface simplification for canonical server-handled uploads.
- **services/api**: Files and notes routes plus integration tests covering canonical note and upload flows.
- **Web E2E pipeline**: Fewer brittle sync points, stronger pre-E2E contract coverage, and clearer failure diagnostics.
