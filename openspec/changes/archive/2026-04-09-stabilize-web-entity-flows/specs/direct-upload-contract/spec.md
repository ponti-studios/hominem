## ADDED Requirements

### Requirement: File upload uses one canonical HTTP contract in all environments
The system SHALL preserve the same browser-facing upload lifecycle in production and test environments: the browser uploads the file to one API endpoint and receives a canonical uploaded file record in the response.

#### Scenario: Test environment preserves the same upload contract
- **WHEN** the application runs in test mode
- **THEN** the browser SHALL use the same HTTP upload request shape as production
- **AND** the API SHALL return the same canonical uploaded file response shape as production

#### Scenario: Storage adapter changes without browser protocol drift
- **WHEN** test mode uses in-memory or local storage instead of production object storage
- **THEN** the browser-facing upload contract SHALL remain unchanged
- **AND** only the server-side storage implementation SHALL differ

### Requirement: Upload success returns canonical file records
The upload lifecycle SHALL not be considered complete until the upload request succeeds and returns a canonical uploaded file record.

#### Scenario: Successful upload returns canonical file identity
- **WHEN** a file is uploaded successfully
- **THEN** the upload endpoint SHALL return a canonical file identifier and persisted file metadata
- **AND** the client SHALL use that canonical file record for subsequent note and chat attachment flows

#### Scenario: Failed persistence prevents canonical success
- **WHEN** the server cannot store, process, or persist the uploaded file
- **THEN** the upload request SHALL fail
- **AND** the client SHALL NOT transition the upload flow to canonical success

### Requirement: Canonical upload lifecycle has integration coverage
The system SHALL provide integration coverage for the real note-agnostic upload contract below the browser E2E layer.

#### Scenario: Integration test exercises the real upload seam
- **WHEN** integration tests run against the test server
- **THEN** they SHALL cover a browser-equivalent HTTP upload request to the canonical upload endpoint
- **AND** they SHALL assert that the canonical file record is persisted and returned
