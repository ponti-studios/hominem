## MODIFIED Requirements

### Requirement: Upload state machine defines explicit lifecycle states
The upload state machine SHALL define exactly six states: `idle`, `preparing`, `uploading`, `completing`, `done`, and `error`. The system SHALL transition through states in order: `idle` → `preparing` → `uploading` → `completing` → `done`. Error states SHALL transition to `error` from any non-terminal state. The `done` state SHALL represent canonical upload completion, not merely successful local byte submission.

#### Scenario: Successful upload transitions through all states
- **WHEN** user selects a file for upload
- **THEN** state SHALL transition from `idle` → `preparing` → `uploading` → `completing` → `done` in sequence
- **AND** `done` SHALL only be reached after the canonical completion step succeeds

#### Scenario: Upload failure transitions to error state
- **WHEN** an upload error occurs during the `uploading` state
- **THEN** state SHALL transition from `uploading` → `error`

### Requirement: Upload state is observable via DOM attributes
The system SHALL render the current upload state to the DOM via a `data-upload-state` attribute on the upload container element. The system SHALL render upload progress (0-100) via a `data-upload-progress` attribute on the same element. These attributes SHALL be updated synchronously with state transitions. The `data-upload-state="done"` attribute SHALL mean the canonical upload lifecycle completed successfully.

#### Scenario: Test observes upload completion via data attribute
- **WHEN** an upload completes successfully
- **THEN** the container element SHALL have `data-upload-state="done"`
- **AND** the canonical uploaded file record SHALL be available for subsequent UI flows

#### Scenario: Test observes upload progress
- **WHEN** an upload is at 50% progress
- **THEN** the container element SHALL have `data-upload-progress="50"`
