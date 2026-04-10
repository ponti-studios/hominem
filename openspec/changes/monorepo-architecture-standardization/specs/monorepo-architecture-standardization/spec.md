## ADDED Requirements

### Requirement: Repository uses explicit layer-specific filenames
The system SHALL separate domain logic, persistence logic, transport payloads, validation schemas, UI view models, and boundary transformations into distinct files with layer-specific suffixes. The system SHALL use precise filenames such as `*.types.ts`, `*.schema.ts`, `*.db.ts`, `*.rpc.ts`, `*.mapper.ts`, `*.service.ts`, `*.repository.ts`, `*.vm.ts`, and `*.hooks.ts` for those purposes.

#### Scenario: New feature introduces separate boundary files
- **WHEN** a feature needs a persisted row, a transport payload, and a UI shape
- **THEN** the persisted row SHALL live in `*.db.ts`
- **AND** the transport payload SHALL live in `*.rpc.ts`
- **AND** the UI shape SHALL live in `*.vm.ts`
- **AND** any transformation between them SHALL live in `*.mapper.ts`

### Requirement: Dependency flow is one-way
The system SHALL allow apps to depend on packages, RPC and data code to depend on domain code, and domain code to remain free of UI, framework, and persistence imports.

#### Scenario: UI cannot import persistence internals
- **WHEN** web or mobile code needs entity data
- **THEN** it SHALL consume RPC/client or domain-facing abstractions
- **AND** it SHALL NOT import repository or database model code directly

### Requirement: Cross-layer transformations are explicit
The system SHALL require any shape change across boundaries to happen in a clearly named mapper or equivalent boundary conversion file.

#### Scenario: Domain entity becomes a UI view model
- **WHEN** a domain entity is prepared for rendering
- **THEN** a mapper SHALL convert it into a view-model shape before the UI uses it
- **AND** the UI SHALL NOT reshape the domain entity inline for presentation needs

### Requirement: Runtime schemas define boundary data
The system SHALL define runtime validation schemas in `*.schema.ts` for inbound API or RPC data and any other external boundary payloads that require validation.

#### Scenario: Incoming request is validated before business logic
- **WHEN** an API or RPC handler receives external input
- **THEN** it SHALL validate the payload against a schema before invoking business logic
- **AND** invalid input SHALL be rejected before it reaches persistence

### Requirement: Shared code remains purpose-built
The system SHALL only place cross-package code in shared locations when the code has a clear, narrow boundary role. Ambiguous dumping-ground files such as `contracts.ts`, `common.ts`, and `utils.ts` SHALL NOT be used for boundary-bearing concepts.

#### Scenario: Reused boundary logic gets a precise home
- **WHEN** code is shared across apps or packages
- **THEN** it SHALL live in a layer-appropriate module with a precise filename
- **AND** it SHALL NOT be placed in an ambiguous shared file
