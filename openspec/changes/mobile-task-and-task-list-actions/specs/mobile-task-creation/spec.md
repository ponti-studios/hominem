## ADDED Requirements

### Requirement: Mobile chat can transform a conversation into a task review
The mobile chat surface SHALL allow the user to transform the current conversation into a task review when task artifacts are enabled.

#### Scenario: User opens task review from the conversation menu
- **WHEN** the user selects the task transform action from a chat with messages
- **THEN** the system SHALL build a task review from the conversation transcript
- **AND** the review SHALL present the proposed task title, changes, and preview content before save

#### Scenario: Task transform is hidden when disabled
- **WHEN** task artifacts are not enabled for the current release
- **THEN** the mobile conversation menu SHALL NOT show the task transform action

### Requirement: Accepting a task review saves a task artifact
When the user accepts a task review, the system SHALL persist a task artifact and resolve the session source to that task.

#### Scenario: User saves a task review
- **WHEN** the user accepts a task review
- **THEN** the system SHALL create a task artifact from the proposed content
- **AND** the chat header SHALL resolve to the saved task source after persistence succeeds

#### Scenario: Failed task save keeps the review open
- **WHEN** task persistence fails
- **THEN** the system SHALL leave the review visible
- **AND** the session source SHALL remain unchanged

