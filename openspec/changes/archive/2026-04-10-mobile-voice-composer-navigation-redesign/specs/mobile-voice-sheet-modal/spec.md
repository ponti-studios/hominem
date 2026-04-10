## ADDED Requirements

### Requirement: Voice recording uses bottom sheet presentation

The voice recording modal SHALL be presented as a bottom sheet instead of a full-screen modal.

#### Scenario: Bottom sheet presents from bottom
- **WHEN** user taps the voice button in composer
- **THEN** a bottom sheet slides up from the bottom of the screen
- **AND** the sheet has a drag handle at the top

### Requirement: Bottom sheet has snap points

The voice recording bottom sheet SHALL support multiple snap points.

#### Scenario: Sheet snaps to default position
- **WHEN** bottom sheet opens
- **THEN** it snaps to the default snap point (50% of screen height)

#### Scenario: Sheet can be expanded
- **WHEN** user drags the sheet upward
- **THEN** it snaps to an expanded position (90% of screen height)

#### Scenario: Sheet can be dismissed
- **WHEN** user drags the sheet downward past a threshold
- **THEN** the sheet closes
- **AND** any recording is discarded

### Requirement: Bottom sheet has gesture-driven dismiss

The bottom sheet SHALL support gesture-driven dismiss with velocity-based completion.

#### Scenario: Slow drag down dismisses
- **WHEN** user drags sheet down and releases slowly
- **THEN** sheet closes if position exceeds 50% of snap point

#### Scenario: Fast drag down dismisses
- **WHEN** user flicks the sheet downward
- **THEN** sheet closes regardless of position

### Requirement: Backdrop dims behind bottom sheet

The area behind the bottom sheet SHALL be dimmed with an overlay.

#### Scenario: Backdrop shows overlay
- **WHEN** bottom sheet is open
- **THEN** the background is dimmed with semi-transparent overlay
- **AND** tapping the overlay attempts to close the sheet
