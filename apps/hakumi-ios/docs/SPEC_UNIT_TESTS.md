# Spec: Unit Tests

**Status:** Proposed  
**Priority:** High  
**Effort:** Medium (3–5 days)  
**Dependencies:** Environment injection (done), Preview mock data (recommended first)

---

## Problem

The codebase currently has two test files:
- `HakumiTests.swift` — covers `Router`, `AuthService`, `TopAnchorSignal`, and base64 utilities
- `ComposerAndQueryTests.swift` — covers `ComposerState` and `QueryStore`

Current testability score: **3/10**. The gap is that most business logic lives in `AppStores`, `ChatService`, `NoteService`, and the views themselves, none of which have test coverage. The audit found multiple correctness bugs (rollback-at-0, double-fetch on error, silent note creation failures) that unit tests would have caught.

Now that `AppStores` and `ComposerState` are injectable, the cost to test the most critical paths is low.

---

## Goal

Cover the high-risk, high-value paths that are most likely to regress:
1. `AppStores` archive/delete with optimistic mutation and rollback
2. `QueryStore` state machine (loading, prepend, mutate)
3. `ComposerState` submit paths (feed note, chat message, rollback on failure)
4. `Router` navigation logic (already partially covered — extend)

Do not aim for 100% coverage. Aim for coverage of logic that:
- Has already had bugs (rollback, double-fetch)
- Is hard to verify visually
- Would be painful to debug in production

---

## Test Plan

### `AppStoresTests.swift`

```swift
@MainActor
@Test func archiveNoteOptimisticallyRemovesFromBothStores() async {
    let stores = AppStores()
    let note = NoteItem(id: "n1", title: "Test", ...)
    stores.notes.data = [note]
    stores.inbox.data = [.note(InboxNote(id: "note-n1", ...))]

    // NoteService.archiveNote succeeds (mock)
    await stores.archiveNote(id: "n1")

    #expect(stores.notes.data.isEmpty)
    #expect(stores.inbox.data.isEmpty)
}

@MainActor
@Test func archiveNoteRollsBackBothStoresOnFailure() async {
    let stores = AppStores()
    // seed data, make service fail
    // verify both stores restored to original order
}

@MainActor
@Test func deleteNoteRollsBackOnFailure() async { ... }

@MainActor
@Test func archiveChatRollsBackOnFailure() async { ... }
```

**Blocking issue:** `NoteService` and `ChatService` use `static func` with `URLSession.shared` directly — they need to be mockable. Two options:

**Option A (minimal):** Use `MockURLProtocol` (already exists in `HakumiTests/Support/`) by registering it before the test and returning a 500 response to simulate failure.

**Option B (cleaner):** Extract a `NoteServiceProtocol` with the methods used by `AppStores`. `AppStores` accepts a `noteService: NoteServiceProtocol` in its initializer, defaulting to `NoteService.self`. Tests inject a mock.

Option A is lower effort and unblocks tests immediately. Option B is cleaner long-term. **Recommend Option A now, Option B when the service layer grows.**

---

### `QueryStoreTests.swift` (extend existing)

```swift
@MainActor
@Test func prependReplacesPlaceholderWithCommittedItem() async {
    let store = QueryStore<NoteItem>()
    let placeholder = NoteItem(id: "tmp-123", ...)
    let committed = NoteItem(id: "real-456", ...)

    try await store.prepend(placeholder: placeholder) { committed }

    #expect(store.data.first?.id == "real-456")
    #expect(!store.data.contains { $0.id == "tmp-123" })
}

@MainActor
@Test func prependRemovesPlaceholderOnThrow() async {
    let store = QueryStore<NoteItem>()
    let placeholder = NoteItem(id: "tmp-123", ...)

    try? await store.prepend(placeholder: placeholder) {
        throw URLError(.notConnectedToInternet)
    }

    #expect(store.data.isEmpty)
}

@MainActor
@Test func mutateDataPreservesOrderOnNoChange() async { ... }
```

---

### `ComposerStateTests.swift` (extend existing)

Current tests cover target resolution and draft text persistence. Add:

```swift
@MainActor
@Test func submitPrimaryFeedCreatesNoteAndClearsDraft() async {
    // inject mock URLProtocol that returns a valid NoteDetail JSON
    // call submitPrimary(router:)
    // verify draftText == ""
    // verify AppStores.shared.inbox has the new item at index 0
}

@MainActor
@Test func submitPrimaryFeedRestoresDraftOnAPIFailure() async {
    // inject mock URLProtocol returning 500
    // call submitPrimary(router:)
    // verify draftText is restored to original
    // verify submitError is non-nil
}

@MainActor
@Test func clearDraftRemovesPersistedText() {
    let defaults = makeSuite()
    let state = ComposerState(userDefaults: defaults)
    state.draftText = "hello"
    state.clearDraft()
    #expect(defaults.string(forKey: "composer.draft.feed") == nil)
}

@MainActor
@Test func resetClearsAllTargetsAndPersistedDrafts() {
    let defaults = makeSuite()
    defaults.set("feed draft", forKey: "composer.draft.feed")
    defaults.set("chat draft", forKey: "composer.draft.chat:c1")
    let state = ComposerState(userDefaults: defaults)
    state.reset()
    #expect(state.draftText == "")
    #expect(defaults.string(forKey: "composer.draft.feed") == nil)
    #expect(defaults.string(forKey: "composer.draft.chat:c1") == nil)
}
```

---

### `RouterTests.swift` (extend existing)

Current tests cover booting buffering, unauthenticated protected route, and sign-out reset. Add:

```swift
@MainActor
@Test func resetForSignOutClearsComposerState() {
    let router = Router()
    ComposerState.shared.draftText = "unsaved draft"  // or inject
    router.resetForSignOut()
    // verify ComposerState is reset
}
```

---

## Service Mocking Strategy

The existing `MockURLProtocol` in `HakumiTests/Support/` already handles:
- Registering a handler per URL
- Returning custom status codes and body data
- Reading `httpBody`/`httpBodyStream` (fixed in a prior session)

Extend it with convenience helpers:

```swift
extension MockURLProtocol {
    static func succeed(url: URL, json: Any) {
        handlers[url] = { _ in
            let data = try JSONSerialization.data(withJSONObject: json)
            return (HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
    }

    static func fail(url: URL, statusCode: Int = 500) {
        handlers[url] = { _ in
            return (HTTPURLResponse(url: url, statusCode: statusCode, httpVersion: nil, headerFields: nil)!, Data())
        }
    }
}
```

---

## Scope

| File | Change |
|---|---|
| `HakumiTests/AppStoresTests.swift` | New — archive/delete/rollback tests |
| `HakumiTests/ComposerAndQueryTests.swift` | Add submit, rollback, reset tests |
| `HakumiTests/RouterTests.swift` | Rename from `HakumiTests.swift`; add ComposerState reset test |
| `HakumiTests/Support/MockURLProtocol.swift` | Add `succeed(url:json:)` and `fail(url:statusCode:)` helpers |

---

## Out of Scope

- UI/snapshot tests
- XCUITest
- 100% coverage
- Testing SwiftUI view rendering directly

---

## Acceptance Criteria

- [ ] `AppStores.archiveNote` rollback tested: original order restored on failure
- [ ] `AppStores.deleteNote` rollback tested
- [ ] `ComposerState.reset()` clears all persisted UserDefaults keys
- [ ] `ComposerState.submitPrimary` on feed: draft cleared on success, restored on failure
- [ ] `QueryStore.prepend` placeholder replaced on success, removed on throw
- [ ] All new tests pass on `main` without a running server
- [ ] `xcodebuild test` succeeds in CI
