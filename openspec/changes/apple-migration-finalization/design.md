## Context

The Apple app already ships native authentication, notes, chats, media capture, and app-lock behavior on top of a shared `HominemAppleCore` package. The remaining migration work is cross-cutting: it adds a new persistence dependency, changes startup behavior in `AppModel`, extends `NotesStore` and `ChatsStore` with cache-aware loading, introduces background execution in both app targets, applies a macOS-only privacy control at the window layer, and requires new automated verification for currently untested stateful flows.

The current code keeps UI state in `@Observable @MainActor` stores backed directly by `NotesService` and `ChatsService`. That is a good fit for the final migration step because the UI does not need a new architecture; it needs a persistence and sync layer that sits beneath the existing stores and a small extraction of note auto-save logic so it can be tested deterministically.

## Goals / Non-Goals

**Goals:**
- Restore notes, chats, and chat threads from local persistence before network refresh completes.
- Keep the local cache synchronized with successful fetch and mutation results without duplicating business logic across views.
- Run note and chat refresh work from platform background schedulers and persist the results back into the cache.
- Prevent macOS windows from being exposed to screen sharing or recording APIs.
- Add automated coverage for feed ordering, note auto-save debounce behavior, and the core signed-in macOS user journey.

**Non-Goals:**
- Replacing the current `NotesService`, `ChatsService`, or SwiftUI navigation structure.
- Adding live SSE chat streaming, onboarding, snapshot tests, or other Sprint 7 nice-to-have items.
- Building a general-purpose offline mutation queue or conflict resolution system beyond last-successful-write cache updates.

## Decisions

### 1. Use a GRDB-backed `LocalDatabase` actor for Apple-native persistence

The implementation will add `GRDB.swift` to `apps/apple/Package.swift` and introduce a `LocalDatabase` actor inside `HominemAppleCore`. The database will own three user-scoped tables for `notes`, `chats`, and `chat_messages`.

Each table will store the canonical model payload as encoded JSON plus the indexed metadata needed for efficient fetches (`id`, `userId`, `chatId` where applicable, `updatedAt`). This keeps persistence close to the existing Codable models and avoids a second fully normalized model graph.

Why this over alternatives:
- GRDB fits the existing SQLite requirement directly and works in both iOS and macOS without adding a higher-level object graph runtime.
- Storing canonical payloads avoids duplicating field-by-field mappings for every nested value type while still allowing stable sorting and filtering on indexed columns.
- SwiftData or Core Data would add a bigger architectural shift than the remaining migration requires.

### 2. Keep stores as the UI boundary and make them cache-aware

`NotesStore`, `ChatsStore`, and `FeedViewModel` remain the source of truth for the UI. The change will extend store flows so they can:
- hydrate from `LocalDatabase` immediately after session restore,
- refresh from network using the existing services,
- write successful results back into the cache,
- clear persisted data on sign-out.

Why this over alternatives:
- A new repository layer would add indirection without changing the consumer shape of the UI.
- Extending the current stores keeps the change small and preserves the current `AppModel.live()` composition root.

### 3. Centralize background refresh in a shared sync coordinator

Background refresh logic will live in a shared coordinator in `HominemAppleCore`, built on the existing services and `LocalDatabase`. iOS and macOS app targets will only register and schedule platform-specific background entry points, then hand execution off to the shared coordinator.

Why this over alternatives:
- It avoids duplicating fetch-and-persist logic in `HominemAppleiOSApp.swift` and `HominemAppleMacApp.swift`.
- It keeps background behavior consistent with the same cache write path used by foreground refreshes.

### 4. Extract note auto-save behavior from `NoteDetailView` into a testable model object

`NoteDetailView` currently owns debounce timing and async save behavior directly in view state. The implementation should move that logic into a focused `NoteDetailViewModel` or equivalent small controller that owns edited fields, save state, debounce cancellation, and the call to `NotesStore.updateNote`.

Why this over alternatives:
- View-driven `Task.sleep` logic is difficult to test precisely.
- A focused model object allows deterministic unit tests for debounce cancellation, immediate flush on disappear, and failure handling without changing the visible UI contract.

### 5. Apply macOS screen-sharing protection at window creation time

The macOS target will set `NSWindow.sharingType = .none` for every app window during window setup so all signed-in content inherits the same privacy protection.

Why this over alternatives:
- Per-view solutions do not reliably cover the full window surface.
- Window-level configuration matches the platform API and protects new windows consistently.

## Risks / Trade-offs

- [Cached data becomes stale while offline] -> Mitigation: always attempt a foreground refresh after cache hydration and keep pull-to-refresh available as the authoritative manual refresh path.
- [Background execution is opportunistic and may not run on schedule] -> Mitigation: treat background sync as a freshness optimization, not as the only sync mechanism.
- [Persisting account data locally increases privacy sensitivity] -> Mitigation: scope cached rows by user ID, protect the macOS window surface, and clear the local database during sign-out.
- [JSON payload storage reduces SQL-level query flexibility] -> Mitigation: index the fields needed for current app behavior now and revisit normalization only if future offline querying demands it.
- [Extracting note save behavior changes editor internals late in the migration] -> Mitigation: keep the extraction API-shaped around the existing view and cover it with unit tests before broadening behavior.

## Migration Plan

1. Add `GRDB.swift` and create the database schema plus migration bootstrap in `HominemAppleCore`.
2. Wire `AppModel.live()` and the stores to hydrate from cache, write through on successful refresh or mutation, and clear persisted data on sign-out.
3. Add the shared background sync coordinator and connect iOS and macOS scheduling and registration in the app targets and generated app metadata.
4. Apply macOS window privacy configuration and add the missing tests and E2E coverage for the final migration flows.
5. Verify with Apple unit tests, macOS E2E, and any required database migration command prerequisites for auth test flows.

Rollback is straightforward because the change is additive at the app layer: remove scheduler registration, stop wiring the local database, and ship without using the persisted cache if issues appear.

## Open Questions

- Should cached chat message retention be bounded per chat for the first release, or should the app persist the full retrieved thread history until a future pruning pass is added?
- Should background sync refresh only top-level note and chat lists initially, or should it opportunistically refresh the most recently opened chat thread as well?
