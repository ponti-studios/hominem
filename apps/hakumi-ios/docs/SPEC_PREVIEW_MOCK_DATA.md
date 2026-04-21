# Spec: Preview Mock Data

**Status:** Proposed  
**Priority:** High  
**Effort:** Small (1–2 days)  
**Dependencies:** Environment injection (done)

---

## Problem

SwiftUI previews for `InboxScreen` (now `SidebarView`), `NotesScreen`, and `ChatScreen` currently pass `AppStores.shared` into the environment. When Xcode renders a preview, `.task { store.fetch() }` fires, which calls the real API at `localhost:4040`. If the dev server is not running:

- The preview shows a loading spinner forever, or an error state
- There is no way to preview the empty state, loading state, or content state independently
- Iterating on UI requires a running backend

This is the immediate payoff of the environment injection work. The injection plumbing is already in place — it just needs mock data attached to it.

---

## Goal

Every screen should be previewable in all meaningful states without a network connection:
- **Loading** — skeleton or spinner
- **Empty** — empty state illustration/copy
- **Content** — realistic-looking data
- **Error** — error message + retry button

---

## Proposed Solution

### 1. Static fixture data

Create `HakumiTests/Support/Fixtures.swift` (or `Hakumi/Preview Support/Fixtures.swift` if it should ship in the app target for previews):

```swift
extension NoteItem {
    static let fixtures: [NoteItem] = [
        NoteItem(id: "n1", title: "Meeting notes", content: "...", createdAt: .now - 3600, updatedAt: .now - 3600, hasAttachments: false),
        NoteItem(id: "n2", title: "Project ideas", content: "...", createdAt: .now - 86400, updatedAt: .now - 86400, hasAttachments: true),
        NoteItem(id: "n3", title: "Untitled", content: "", createdAt: .now - 7 * 86400, updatedAt: .now - 7 * 86400, hasAttachments: false),
    ]
}

extension InboxItem {
    static let fixtures: [InboxItem] = [
        .note(InboxNote(id: "note-n1", title: "Meeting notes", excerpt: "Discussed Q2 goals...", updatedAt: .now - 3600)),
        .chat(InboxChat(id: "c1", title: "Project discussion", lastMessage: "Sure, let's do it", updatedAt: .now - 7200)),
        .note(InboxNote(id: "note-n2", title: "Project ideas", excerpt: nil, updatedAt: .now - 86400)),
    ]
}

extension ChatMessage {
    static let fixtures: [ChatMessage] = [
        ChatMessage(id: "m1", role: .user, content: "Can you summarize my meeting notes?", createdAt: .now - 120),
        ChatMessage(id: "m2", role: .assistant, content: "Sure! Here's a summary...", createdAt: .now - 110),
    ]
}
```

### 2. `AppStores.preview` factory

```swift
extension AppStores {
    @MainActor
    static func preview(
        inbox: [InboxItem] = InboxItem.fixtures,
        notes: [NoteItem] = NoteItem.fixtures
    ) -> AppStores {
        let stores = AppStores()
        stores.inbox.data = inbox
        stores.inbox.loadingState = .loaded
        stores.notes.data = notes
        stores.notes.loadingState = .loaded
        return stores
    }

    @MainActor static var previewEmpty: AppStores { preview(inbox: [], notes: []) }
    @MainActor static var previewLoading: AppStores {
        let stores = AppStores()
        // loadingState stays .loading (initial)
        return stores
    }
    @MainActor static var previewError: AppStores {
        let stores = AppStores()
        stores.inbox.errorMessage = "Could not connect to server."
        stores.notes.errorMessage = "Could not connect to server."
        return stores
    }
}
```

### 3. Updated previews

Each screen gets multiple preview variants:

```swift
#Preview("Content") {
    NavigationStack { SidebarView() }
        .environment(AppStores.preview())
        .environment(ComposerState.shared)
        .environment(Router())
}

#Preview("Empty") {
    NavigationStack { SidebarView() }
        .environment(AppStores.previewEmpty)
        .environment(ComposerState.shared)
        .environment(Router())
}

#Preview("Loading") {
    NavigationStack { SidebarView() }
        .environment(AppStores.previewLoading)
        .environment(ComposerState.shared)
        .environment(Router())
}
```

---

## Scope

| File | Change |
|---|---|
| `Preview Support/Fixtures.swift` | New — static data for `NoteItem`, `InboxItem`, `ChatMessage`, `ComposerNote` |
| `Services/Query/AppStores.swift` | Add `preview()`, `previewEmpty`, `previewLoading`, `previewError` |
| `Screens/Sidebar/SidebarView.swift` | Add 3–4 preview variants |
| `Screens/Notes/NotesScreen.swift` | Add 3–4 preview variants |
| `Screens/Chat/ChatScreen.swift` | Add content + loading + empty previews |
| `Screens/Settings/SettingsScreen.swift` | Add preview (already mostly static) |
| `Screens/Auth/AuthSignInView.swift` | Already previewable — no change needed |

---

## Out of Scope

- `XCTest` unit tests (separate spec)
- UI/snapshot tests
- Mocking `AuthProvider` or `ChatService` — previews only need store data

---

## Acceptance Criteria

- [ ] All screens render correctly in Xcode canvas without a running server
- [ ] Content, empty, loading, and error states are each previewable independently
- [ ] No new network calls fire during preview rendering
- [ ] Fixtures are realistic enough to catch layout issues (long titles, empty content, attachments, etc.)
