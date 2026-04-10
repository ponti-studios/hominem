## ADDED Requirements

### Requirement: Composer drafts are auto-saved periodically

The composer SHALL automatically save drafts to persistent storage every 5 seconds when changes are made.

#### Scenario: Draft is auto-saved
- **WHEN** user is typing in the composer
- **THEN** after 5 seconds of inactivity, the draft is saved
- **AND** subsequent changes restart the 5-second timer

### Requirement: Drafts are restored on screen mount

When a user navigates to a composer screen, any existing draft SHALL be restored.

#### Scenario: Draft is restored on mount
- **WHEN** user navigates to a composer screen with an existing draft
- **THEN** the previous text and attachments are restored
- **AND** the user can continue editing

### Requirement: Draft is cleared on successful submit

When a message or note is successfully submitted, the draft SHALL be cleared.

#### Scenario: Submit clears draft
- **WHEN** user successfully submits the composer content
- **THEN** the draft is cleared from persistent storage
- **AND** the composer is reset to empty state

### Requirement: Draft indicator shows save status

The composer SHALL show a subtle indicator when a draft is being saved or has been saved.

#### Scenario: Save indicator appears
- **WHEN** a draft is being saved
- **THEN** a small indicator (e.g., "Saving..." or cloud icon) may briefly appear
- **AND** the indicator disappears after save completes

### Requirement: Draft respects reduced motion setting

Draft persistence SHALL respect the user's reduced motion accessibility setting.

#### Scenario: No animations when reduced motion is on
- **WHEN** the device has reduced motion enabled
- **THEN** draft save/restore animations are disabled
