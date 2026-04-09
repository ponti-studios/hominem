## ADDED Requirements

### Requirement: Test-only storage methods are explicitly typed
The storage service interface SHALL expose test-only methods prefixed with `__testOnly`. These methods SHALL only be available when `NODE_ENV === 'test'`. The system SHALL provide compile-time type checking for test-only methods. Production code SHALL NOT reference test-only methods.

#### Scenario: Test code uses type-safe test method
- **WHEN** test code calls `storage.__testOnlyStoreFile(filePath, buffer)`
- **THEN** the call SHALL be type-checked at compile time
- **AND** the file SHALL be stored in test storage

#### Scenario: Production code cannot access test methods
- **WHEN** production code attempts to call `storage.__testOnlyStoreFile()`
- **THEN** TypeScript SHALL report a compilation error

### Requirement: Remove Proxy pattern from test storage
The system SHALL remove the Proxy pattern that hides test-only capabilities. The `InMemoryStorageBackend` class SHALL expose its methods directly without Proxy wrapping. Type casting (`as any`) SHALL NOT be required to access test storage methods.

#### Scenario: Direct method access without casting
- **WHEN** test code accesses storage methods
- **THEN** no type casting SHALL be required
- **AND** methods SHALL be accessible through standard property access

#### Scenario: No Proxy overhead in test mode
- **WHEN** storage methods are called in test mode
- **THEN** calls SHALL be direct (no Proxy interception)

### Requirement: Remove unused test upload endpoint
The system SHALL remove the `/test/upload/:filePath*` HTTP endpoint from the files route. The `storeFileWithExactKey` method SHALL only be accessible through the test interface, not via HTTP. E2E tests SHALL use the browser upload flow exclusively.

#### Scenario: Test endpoint returns 404
- **WHEN** a request is made to `PUT /test/upload/any-path`
- **THEN** the server SHALL return HTTP 404 Not Found

#### Scenario: E2E tests use browser upload
- **WHEN** E2E tests upload files
- **THEN** they SHALL use the file input element and browser upload flow
- **AND** they SHALL NOT use the test endpoint
