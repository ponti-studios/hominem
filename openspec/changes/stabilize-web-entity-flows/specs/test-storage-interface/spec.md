## MODIFIED Requirements

### Requirement: Test-only storage methods are explicitly typed
The storage service interface SHALL expose test-only methods prefixed with `__testOnly`. These methods SHALL only be available when `NODE_ENV === 'test'`. The system SHALL provide compile-time type checking for test-only methods. Production code SHALL NOT reference test-only methods. Test-only methods SHALL support the canonical direct upload contract rather than creating a separate browser-facing protocol.

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

### Requirement: Test storage preserves the direct upload contract
Test storage SHALL support the same browser-facing direct upload lifecycle used in production. The system SHALL NOT depend on hidden test-only protocol drift to receive uploaded bytes during browser flows.

#### Scenario: Browser upload in test mode uses the canonical contract
- **WHEN** browser-based E2E or integration tests upload files in test mode
- **THEN** the test storage implementation SHALL support the returned upload target from `prepare-upload`
- **AND** the canonical `prepare-upload -> upload bytes -> complete-upload` lifecycle SHALL succeed without requiring a separate ad hoc browser protocol

#### Scenario: Test storage failures surface as canonical upload failures
- **WHEN** test storage cannot receive or expose uploaded bytes for completion
- **THEN** the direct upload lifecycle SHALL fail through canonical upload error handling
- **AND** the system SHALL NOT silently rely on an out-of-band test shortcut
