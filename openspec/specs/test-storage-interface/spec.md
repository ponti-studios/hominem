## MODIFIED Requirements

### Requirement: Test-only storage methods are explicitly typed
The storage service interface SHALL expose test-only methods prefixed with `__testOnly` only when tests need internal storage setup or verification. These methods SHALL only be available when `NODE_ENV === 'test'`. The system SHALL provide compile-time type checking for test-only methods. Production code SHALL NOT reference test-only methods. Browser upload flows SHALL NOT depend on test-only storage methods.

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

### Requirement: Test storage remains an internal persistence concern
Test storage SHALL remain an internal blob persistence implementation detail. The browser-facing upload contract SHALL terminate at the canonical upload API endpoint rather than depending on test storage protocol behavior.

#### Scenario: Browser upload in test mode uses the canonical API contract
- **WHEN** browser-based E2E or integration tests upload files in test mode
- **THEN** the browser SHALL send the same upload request shape to the canonical upload endpoint as production
- **AND** test storage SHALL only participate behind that API boundary

#### Scenario: Test storage failures surface as canonical upload failures
- **WHEN** test storage cannot store or expose uploaded bytes behind the upload API
- **THEN** the canonical upload request SHALL fail through normal upload error handling
- **AND** the system SHALL NOT silently rely on an out-of-band test shortcut
