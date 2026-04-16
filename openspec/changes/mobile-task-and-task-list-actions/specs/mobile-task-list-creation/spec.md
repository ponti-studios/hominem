## ADDED Requirements

### Requirement: Mobile chat can transform a conversation into a task list review
The mobile chat surface SHALL allow the user to transform the current conversation into a task list review when task list artifacts are enabled.

#### Scenario: User opens task list review from the conversation menu
- **WHEN** the user selects the task list transform action from a chat with messages
- **THEN** the system SHALL build a task list review from the conversation transcript
- **AND** the review SHALL present the proposed task list title, changes, and preview content before save

#### Scenario: Task list transform is hidden when disabled
- **WHEN** task list artifacts are not enabled for the current release
- **THEN** the mobile conversation menu SHALL NOT show the task list transform action

### Requirement: Accepting a task list review saves a task list artifact
When the user accepts a task list review, the system SHALL persist a task list artifact and resolve the session source to that task list.

#### Scenario: User saves a task list review
- **WHEN** the user accepts a task list review
- **THEN** the system SHALL create a task list artifact from the proposed content
- **AND** the chat header SHALL resolve to the saved task list source after persistence succeeds

#### Scenario: Failed task list save keeps the review open
- **WHEN** task list persistence fails
- **THEN** the system SHALL leave the review visible
- **AND** the session source SHALL remain unchanged

