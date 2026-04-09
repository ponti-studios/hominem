## ADDED Requirements

### Requirement: Cached Apple content bootstrap
The Apple app SHALL restore the authenticated user's cached notes and chats from local persistence before waiting for a foreground network refresh.

#### Scenario: Launch with cached content and a reachable network
- **WHEN** the app launches with a valid signed-in session and cached notes or chats exist
- **THEN** the notes, chats, and merged feed views display the cached content before the network refresh completes

#### Scenario: Launch while offline
- **WHEN** the app launches with a valid signed-in session, cached notes or chats exist, and the API is unavailable
- **THEN** the app continues showing the cached content instead of an empty signed-in state

### Requirement: Cached chat thread access
The Apple app SHALL persist retrieved chat messages by chat ID and load cached messages for a chat thread before or in place of a network fetch when recent thread data exists.

#### Scenario: Open a previously viewed chat thread
- **WHEN** the user opens a chat whose messages were previously fetched on the same signed-in account
- **THEN** the app loads the cached thread messages for that chat before applying newer network results

#### Scenario: Open a chat thread while offline
- **WHEN** the user opens a chat whose messages are cached and the API request fails
- **THEN** the app keeps the cached thread visible and surfaces the refresh failure without clearing the cached messages

### Requirement: Cache write-through and privacy clearing
The Apple app SHALL write successful note, chat, and chat message refresh or mutation results into local persistence, and it SHALL clear persisted Apple content when the user signs out.

#### Scenario: Successful foreground refresh updates the cache
- **WHEN** a note list, chat list, or chat thread refresh succeeds
- **THEN** the persisted rows for the affected user are replaced with the successful results

#### Scenario: Successful mutation updates the cache
- **WHEN** the user creates, updates, archives, or deletes a note or chat successfully
- **THEN** the persisted data is updated so the next launch reflects the successful mutation without requiring another network fetch

#### Scenario: Sign-out clears persisted content
- **WHEN** the user signs out of the Apple app
- **THEN** the app removes persisted notes, chats, and chat messages for that session before returning to the signed-out state
