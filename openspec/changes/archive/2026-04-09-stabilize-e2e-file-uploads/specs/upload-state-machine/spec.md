## ADDED Requirements

### Requirement: Upload state machine defines explicit lifecycle states
The upload state machine SHALL define exactly five states: `idle`, `preparing`, `uploading`, `completing`, and `done`. The system SHALL transition through states in order: `idle` → `preparing` → `uploading` → `completing` → `done`. Error states SHALL transition to `error` from any non-terminal state.

#### Scenario: Successful upload transitions through all states
- **WHEN** user selects a file for upload
- **THEN** state SHALL transition from `idle` → `preparing` → `uploading` → `completing` → `done` in sequence

#### Scenario: Upload failure transitions to error state
- **WHEN** an upload error occurs during the `uploading` state
- **THEN** state SHALL transition from `uploading` → `error`

### Requirement: Upload state is observable via DOM attributes
The system SHALL render the current upload state to the DOM via a `data-upload-state` attribute on the upload container element. The system SHALL render upload progress (0-100) via a `data-upload-progress` attribute on the same element. These attributes SHALL be updated synchronously with state transitions.

#### Scenario: Test observes upload completion via data attribute
- **WHEN** an upload completes successfully
- **THEN** the container element SHALL have `data-upload-state="done"`

#### Scenario: Test observes upload progress
- **WHEN** an upload is at 50% progress
- **THEN** the container element SHALL have `data-upload-progress="50"`

### Requirement: Upload modules preload in test mode
The system SHALL eagerly load Uppy and AWS S3 modules when `NODE_ENV === 'test'` during hook initialization. The preloaded modules SHALL be available immediately when `uploadFiles()` is called. Production builds SHALL continue to lazy-load modules.

#### Scenario: First upload in test mode uses preloaded modules
- **WHEN** the hook initializes in test mode
- **THEN** Uppy modules SHALL be loaded before any upload is initiated

#### Scenario: Production builds lazy-load modules
- **WHEN** the hook initializes in production mode
- **THEN** Uppy modules SHALL NOT be loaded until `uploadFiles()` is called

### Requirement: State transitions are atomic and synchronous
State transitions SHALL be atomic operations. The system SHALL NOT allow multiple concurrent uploads to create race conditions in state. Each upload operation SHALL complete (reach `done` or `error`) before another upload can begin.

#### Scenario: Concurrent uploads are queued
- **WHEN** user selects files while another upload is in progress
- **THEN** subsequent uploads SHALL wait for the current upload to complete
