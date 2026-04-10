## ADDED Requirements

### Requirement: Web E2E tests synchronize on canonical domain outcomes
Critical web E2E tests SHALL synchronize on canonical domain outcomes such as canonical routes, persisted attachment records, and completed canonical upload requests rather than incidental DOM timing or optimistic-only UI state.

#### Scenario: Note creation test waits on canonical route
- **WHEN** a web E2E test creates a note from the notes index
- **THEN** the test SHALL wait for the canonical `/notes/<note-id>` route and note editor readiness
- **AND** it SHALL NOT treat an optimistic feed row as the authoritative created-note state

#### Scenario: Upload test waits on canonical attachment completion
- **WHEN** a web E2E test uploads a file in chat or note flows
- **THEN** the test SHALL wait for the upload flow to reach canonical completion
- **AND** it SHALL assert the persisted attachment is visible after reload when the product flow requires persistence

### Requirement: Critical web flows have pre-E2E integration seams
The system SHALL provide lower-level integration tests for critical web entity and upload flows so protocol drift is detected before full-browser E2E execution.

#### Scenario: Canonical note creation is tested below Playwright
- **WHEN** test suites run below the Playwright layer
- **THEN** they SHALL include coverage for canonical note creation success and failure semantics
- **AND** they SHALL verify route- or entity-level success conditions independent of feed rendering details

#### Scenario: Canonical upload contract is tested below Playwright
- **WHEN** test suites run below the Playwright layer
- **THEN** they SHALL include coverage for canonical upload success and failure semantics using the real upload contract

### Requirement: E2E failures provide domain-specific diagnostics
Critical web E2E helpers SHALL surface failure context in terms of canonical domain states such as missing route transitions, failed completion steps, or missing persisted records.

#### Scenario: Canonical route failure is distinguishable from feed timing
- **WHEN** note creation does not complete in a web E2E test
- **THEN** the failure output SHALL distinguish canonical route failure from feed rendering behavior

#### Scenario: Upload completion failure is distinguishable from local UI progress
- **WHEN** file upload does not complete in a web E2E test
- **THEN** the failure output SHALL distinguish canonical upload request failure from local input interaction timing
