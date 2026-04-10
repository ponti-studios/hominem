## ADDED Requirements

### Requirement: Note creation converges on a canonical note route
The web application SHALL treat note creation as successful only after the server returns a canonical note identifier. After successful creation, the application SHALL navigate the user to the canonical note route for that identifier.

#### Scenario: Saving a new note opens the canonical editor
- **WHEN** a user saves a note from the notes index composer
- **THEN** the system SHALL wait for the canonical note creation response
- **AND** the browser SHALL navigate to `/notes/<note-id>` using the returned canonical note identifier
- **AND** the note editor SHALL render for that canonical note

#### Scenario: Feed refresh is secondary to canonical navigation
- **WHEN** a note is created successfully from the notes index
- **THEN** the canonical note route SHALL become the primary success path
- **AND** any notes feed refresh SHALL occur after or independently of canonical navigation

### Requirement: Optimistic note rows are non-canonical
Any optimistic representation of a newly created note SHALL be treated as non-canonical UI state. The system SHALL NOT require an optimistic feed row to be replaced in-place before canonical navigation or canonical note rendering can succeed.

#### Scenario: Canonical success does not depend on feed-row replacement
- **WHEN** the notes feed renders an optimistic row during creation
- **THEN** the system SHALL still navigate to the canonical note route once the server returns the canonical note identifier
- **AND** the note detail experience SHALL NOT depend on the feed row being replaced first

#### Scenario: Duplicate title matches do not define success
- **WHEN** an optimistic row and a canonical row temporarily share the same visible title
- **THEN** canonical note creation success SHALL be defined by the canonical note identifier and route
- **AND** the system SHALL NOT treat a title-matched feed link as the authoritative created-note state

### Requirement: Failed note creation rolls back immediately
If note creation fails, the system SHALL remove or invalidate any optimistic note state without waiting on animation completion or other non-data side effects.

#### Scenario: Failed create removes optimistic note state
- **WHEN** the create-note request fails after optimistic UI is shown
- **THEN** the optimistic note state SHALL be rolled back immediately from the authoritative client state
- **AND** the user SHALL remain on the notes index without a canonical note route transition

#### Scenario: UI animation cannot block rollback
- **WHEN** note creation fails while an optimistic row exit animation is available
- **THEN** cache rollback and canonical client state restoration SHALL NOT wait for the animation to complete
