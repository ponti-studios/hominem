## ADDED Requirements

### Requirement: Direct upload uses one contract in all environments
The system SHALL preserve the same browser-facing direct upload lifecycle in production and test environments: `prepare-upload`, upload bytes to the returned upload target, and `complete-upload`.

#### Scenario: Test environment preserves direct upload lifecycle
- **WHEN** the application runs in test mode
- **THEN** `prepare-upload` SHALL return an upload target that supports browser byte upload
- **AND** the client SHALL use the same `prepare-upload -> upload bytes -> complete-upload` sequence as production

#### Scenario: Storage adapter changes without protocol drift
- **WHEN** test mode uses in-memory or local storage instead of production object storage
- **THEN** the browser-facing upload contract SHALL remain unchanged
- **AND** only the backing storage adapter SHALL differ

### Requirement: Upload completion returns canonical file records
The upload lifecycle SHALL not be considered complete until `complete-upload` succeeds and returns a canonical uploaded file record.

#### Scenario: Successful upload returns canonical file identity
- **WHEN** a file is uploaded successfully
- **THEN** `complete-upload` SHALL return a canonical file identifier and persisted file metadata
- **AND** the client SHALL use that canonical file record for subsequent note and chat attachment flows

#### Scenario: Missing uploaded bytes prevent completion
- **WHEN** uploaded bytes are not present at completion time
- **THEN** `complete-upload` SHALL fail
- **AND** the client SHALL NOT transition the upload flow to canonical success

### Requirement: Direct upload lifecycle has integration coverage
The system SHALL provide integration coverage for the real note-agnostic direct upload protocol below the browser E2E layer.

#### Scenario: Integration test exercises the real protocol seam
- **WHEN** integration tests run against the test server
- **THEN** they SHALL cover `prepare-upload`, browser-equivalent byte upload to the returned target, and `complete-upload`
- **AND** they SHALL assert that the canonical file record is persisted and returned
