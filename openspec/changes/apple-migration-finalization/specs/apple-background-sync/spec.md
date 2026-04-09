## ADDED Requirements

### Requirement: Background refresh registration
The Apple app SHALL register background refresh handlers on iOS and macOS during app startup so note and chat sync can run without foregrounding the app.

#### Scenario: iOS launch registers the refresh task
- **WHEN** the iOS app starts
- **THEN** it registers the configured background refresh task identifier before scheduling future refresh work

#### Scenario: macOS launch registers background activity
- **WHEN** the macOS app starts
- **THEN** it configures the background activity scheduler used to request note and chat refresh work

### Requirement: Background refresh updates local cache
Background refresh executions SHALL use the authenticated session to fetch the latest note and chat data and persist the successful results into the Apple local cache.

#### Scenario: Background sync succeeds for a signed-in user
- **WHEN** a scheduled background refresh runs while a valid signed-in session is available
- **THEN** the app fetches note and chat updates and writes the successful results into local persistence for later foreground use

#### Scenario: Background sync runs without a valid session
- **WHEN** a scheduled background refresh fires and the app has no restorable signed-in session
- **THEN** the app skips remote fetch work and does not create or mutate cached user content

### Requirement: Background refresh scheduling remains safe to repeat
The Apple app SHALL reschedule future background refresh work after each execution attempt and MUST avoid overlapping note and chat sync runs.

#### Scenario: Refresh attempt finishes
- **WHEN** a background refresh completes successfully or fails
- **THEN** the app schedules the next refresh request according to the platform scheduler contract

#### Scenario: A refresh is already in progress
- **WHEN** another background or foreground sync request starts while a sync is still running
- **THEN** the app suppresses the overlapping execution instead of issuing duplicate note and chat fetches
