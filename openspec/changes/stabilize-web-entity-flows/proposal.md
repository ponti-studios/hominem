## Why

Web note creation and file attachment flows are failing in CI because the system relies on optimistic UI and test-only storage shortcuts instead of converging on canonical entity state. We need one stable contract for note creation, one stable contract for direct uploads, and E2E tests that synchronize against domain truth instead of incidental DOM timing.

## What Changes

- Make note creation converge on canonical note IDs and note detail routes instead of treating optimistic feed rows as the primary success path.
- Define an environment-independent direct upload contract so test mode follows the same `prepare-upload -> upload bytes -> complete-upload` lifecycle as production.
- Establish web E2E contracts around canonical route transitions, persisted attachments, and explicit domain-level synchronization points.
- Add targeted integration coverage and runtime response validation for note creation and direct upload flows so protocol drift is caught before Playwright.

## Capabilities

### New Capabilities
- `canonical-note-creation`: Canonical note creation behavior for web flows, including success, error, and navigation semantics.
- `direct-upload-contract`: A stable direct upload lifecycle that preserves the same contract across production and test environments.
- `web-e2e-contracts`: Stable domain-level synchronization rules and intermediate integration seams for critical web E2E flows.

### Modified Capabilities
- `upload-state-machine`: Refine upload state semantics so `done` reflects a successfully completed canonical upload lifecycle rather than local UI progress alone.
- `test-storage-interface`: Replace test-mode storage shortcuts with an explicit test storage model that supports the direct upload contract without hidden protocol drift.

## Impact

- **apps/web**: `use-notes`, `use-file-upload`, notes and chat routes, route tests, and Playwright helpers/specs.
- **packages/platform/rpc**: API response parsing and runtime validation for note and file mutations.
- **packages/core/utils**: Test storage behavior and direct upload support in the in-memory backend.
- **services/api**: Files and notes routes plus integration tests covering canonical note and upload flows.
- **Web E2E pipeline**: Fewer brittle sync points, stronger pre-E2E contract coverage, and clearer failure diagnostics.
