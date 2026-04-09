## ADDED Requirements

### Requirement: Feed ordering is covered by unit tests
The Apple test suite SHALL include unit coverage proving that the merged feed orders notes and chats by descending `updatedAt` and surfaces store refresh errors.

#### Scenario: Newest content appears first
- **WHEN** feed test fixtures include notes and chats with different `updatedAt` timestamps
- **THEN** the unit tests verify that `FeedViewModel` emits feed items in descending timestamp order regardless of content type

#### Scenario: A store refresh fails
- **WHEN** either the notes or chats refresh path fails during a feed refresh test
- **THEN** the unit tests verify that the feed model preserves the surfaced error state instead of silently succeeding

### Requirement: Note auto-save is covered by unit tests
The Apple test suite SHALL include deterministic unit coverage for note editing debounce, immediate flush on view exit, and save failure state handling.

#### Scenario: Rapid edits collapse into one save
- **WHEN** the user changes a note multiple times before the debounce interval elapses
- **THEN** the unit tests verify that only the latest edit is submitted to the note update path

#### Scenario: The editor disappears with a pending save
- **WHEN** the note editor is dismissed while an auto-save is pending
- **THEN** the unit tests verify that the pending edit is flushed immediately

#### Scenario: A save request fails
- **WHEN** the note update path throws an error during an auto-save test
- **THEN** the unit tests verify that the save state transitions to a visible failure state

### Requirement: macOS native end-to-end coverage includes core signed-in flows
The macOS Apple E2E suite SHALL verify email OTP sign-in plus at least note creation, chat send, settings access, and sign-out against the local API test environment.

#### Scenario: End-to-end signed-in workflow succeeds
- **WHEN** the macOS UI tests run against the configured local auth test environment
- **THEN** the suite signs in with email OTP, creates a note, sends a chat message, visits settings, and signs out successfully

#### Scenario: Local auth test hooks are misconfigured
- **WHEN** the macOS UI tests start without the required OTP test environment values
- **THEN** the test run fails with an explicit configuration error instead of timing out silently
