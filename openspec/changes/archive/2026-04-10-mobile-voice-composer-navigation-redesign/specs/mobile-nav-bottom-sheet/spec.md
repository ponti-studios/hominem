## ADDED Requirements

### Requirement: Voice and camera modals use bottom sheet

Voice recording and camera capture SHALL be presented using bottom sheet components.

#### Scenario: Voice modal uses bottom sheet
- **WHEN** user taps the voice button in composer
- **THEN** a bottom sheet slides up with voice recording controls

#### Scenario: Camera modal uses bottom sheet
- **WHEN** user taps the camera button in composer
- **THEN** a bottom sheet slides up with camera capture

### Requirement: Bottom sheet supports drag gestures

Bottom sheets SHALL be draggable with spring-back behavior at snap points.

#### Scenario: Drag handle exists
- **WHEN** bottom sheet is open
- **THEN** a visible drag handle is displayed at the top
- **AND** the handle is 40px wide, 4px tall, with rounded ends

### Requirement: Bottom sheet can be dragged to close

Users SHALL be able to drag the bottom sheet downward to dismiss it.

#### Scenario: Drag down closes sheet
- **WHEN** user drags the sheet below the closed snap point
- **THEN** the sheet closes completely
- **AND** any in-progress recording is cancelled

#### Scenario: Fast flick closes sheet
- **WHEN** user flicks the sheet downward with velocity
- **THEN** the sheet closes based on the flick velocity
- **AND** no minimum drag distance is required

### Requirement: Bottom sheet has configurable snap points

Each bottom sheet SHALL have configurable snap points for different content heights.

#### Scenario: Voice sheet has 50% and 90% snap points
- **WHEN** voice recording bottom sheet is open
- **THEN** it can snap to 50% or 90% of screen height
- **AND** default snap point is 50%

#### Scenario: Camera sheet has 50% and 90% snap points
- **WHEN** camera capture bottom sheet is open
- **THEN** it can snap to 50% or 90% of screen height
- **AND** default snap point is 90% (full camera preview)
