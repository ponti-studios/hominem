## Why

The Apple app already covers core authentication, notes, chats, and native media flows, but the migration is not yet production-ready because offline persistence, background refresh, platform hardening, and verification gaps remain. Completing those last capabilities now turns the current SwiftUI foundation into a shippable native client instead of leaving critical reliability work as follow-up.

## What Changes

- Add a native local cache layer for notes, chats, and chat messages so the Apple app can restore prior state immediately on launch and continue serving recent data when network access is unavailable.
- Add background sync scheduling for iOS and macOS so cached notes and chats stay fresh without requiring the user to foreground the app.
- Add macOS screen sharing protection and the remaining Apple-specific production hardening needed to protect sensitive content in desktop sessions.
- Add the missing verification coverage for the unfinished migration work, including unit tests for merged feed ordering and note save behavior, plus expanded end-to-end validation for native auth and content flows.

## Capabilities

### New Capabilities
- `apple-local-cache`: Persist notes, chats, and chat messages in a native SQLite store and serve cached content during app startup and offline use.
- `apple-background-sync`: Refresh note and chat data from the background on iOS and macOS and reconcile refreshed results into the local cache.
- `apple-desktop-privacy`: Prevent macOS window capture for sensitive app content during screen sharing and recording.
- `apple-migration-verification`: Verify the finished Apple migration with unit and end-to-end coverage for feed ordering, debounced note saves, and core signed-in flows.

### Modified Capabilities

None.

## Impact

- Affected code: `apps/apple/Sources/HominemAppleCore/**`, `apps/apple/Tests/HominemAppleCoreTests/**`, `apps/apple/macOSUITests/**`, `apps/apple/Package.swift`, and `apps/apple/project.yml`.
- Dependencies: adds `GRDB.swift` for native SQLite persistence and may require background task configuration in generated Apple app metadata.
- Systems: Apple app startup, notes and chats stores, background execution, macOS window behavior, and Apple test automation.
