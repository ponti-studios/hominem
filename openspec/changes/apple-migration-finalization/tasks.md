## 1. Local Cache Foundation

- [x] 1.1 Add `GRDB.swift` to `apps/apple/Package.swift` and wire any required project generation support for the Apple targets.
- [x] 1.2 Implement a `LocalDatabase` actor in `HominemAppleCore` with migrations and user-scoped tables for notes, chats, and chat messages.
- [x] 1.3 Add read and write APIs on the database actor for cached note lists, chat lists, and chat threads using the existing Codable Apple models.

## 2. Cache-Aware Stores And App Boot

- [x] 2.1 Update `AppModel.live()` to build the local database and provide it to the note, chat, and background sync flows.
- [x] 2.2 Extend `NotesStore` to hydrate from cache, write through successful refresh and mutation results, and clear persisted note data on sign-out.
- [x] 2.3 Extend `ChatsStore` to hydrate cached chats and threads, write through successful refresh and send results, and clear persisted chat data on sign-out.
- [x] 2.4 Update feed rebuilding and signed-in boot behavior so cached content appears before network refresh and offline failures do not clear prior results.

## 3. Background Sync

- [x] 3.1 Implement a shared Apple sync coordinator that restores the current session, refreshes notes and chats, persists the results, and suppresses overlapping sync runs.
- [x] 3.2 Register and reschedule iOS background refresh work from `HominemAppleiOSApp` and generated app configuration.
- [x] 3.3 Register and reschedule macOS background activity work from `HominemAppleMacApp`.

## 4. Privacy Hardening And Editor Extraction

- [x] 4.1 Apply `NSWindow.sharingType = .none` to every macOS app window during window setup.
- [x] 4.2 Extract note auto-save debounce and save-state behavior from `NoteDetailView` into a focused testable model object without changing the visible editor flow.
- [x] 4.3 Update `NoteDetailView` to use the extracted note editor model and preserve flush-on-disappear behavior.

## 5. Verification

- [x] 5.1 Add `FeedViewModel` unit tests covering descending mixed-content ordering and error propagation.
- [x] 5.2 Add note editor unit tests covering debounce collapse, immediate flush on disappear, and save failure state handling.
- [x] 5.3 Expand the macOS E2E suite to verify OTP sign-in, note creation, chat send, settings navigation, and sign-out with explicit test-environment validation.
- [x] 5.4 Run the required Apple migration verification commands, including database prep if needed, and fix any regressions before closing the change.
