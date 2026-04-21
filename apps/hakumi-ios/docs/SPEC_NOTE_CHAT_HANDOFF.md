# Spec: Note → Chat Handoff

**Status:** Blocked on API  
**Priority:** Low (blocked)  
**Effort:** Small iOS (< 1 day) + API work  
**Dependencies:** Server must return `chatId` on note detail responses, OR a "find or create chat for note" endpoint

---

## Problem

The note detail screen has a "bubble" toolbar button intended to open a chat in the context of the current note. This feature is currently **disabled** because the implementation routed to `.chat(id: noteId)` — using the note's ID as if it were a chat ID. This is a functional bug (the chat screen would attempt to load a chat that doesn't exist under that ID).

The button is currently hidden with:
```swift
// NoteDetailScreen.swift
// TODO: Requires API to return an associated chatId for the note.
// The note `id` is not a chat ID — routing to .chat(id: noteId) opens a broken screen.
Button { ... }
    .opacity(0)
    .disabled(true)
```

---

## Goal

Allow users to open a chat that is contextually linked to the note they are currently viewing. The chat should have access to the note's content so the assistant can answer questions about it.

---

## API Requirements (must be resolved before iOS work)

**Option A — Server returns `chatId` on note detail**

The `/api/notes/:id` response already returns `NoteDetail`. Add an optional `chatId: String?` field:

```json
{
  "id": "note-123",
  "title": "Meeting notes",
  "content": "...",
  "chatId": "chat-456"   // null if no associated chat yet
}
```

When `chatId` is null, the iOS client calls a "create chat for note" endpoint to get one.

**Option B — "Find or create chat for note" endpoint**

A single endpoint that either returns the existing associated chat or creates a new one:

```
POST /api/notes/:id/chat
→ { "chatId": "chat-456" }
```

This is simpler for the iOS client — one call, always returns a valid `chatId`.

**Recommendation:** Option B. It keeps the iOS client logic trivial and avoids the iOS client having to conditionally create chats.

---

## iOS Changes (after API is available)

### 1. Add `NoteService.findOrCreateChat(noteId:)` or extend `ChatService`

```swift
// ChatService.swift
static func findOrCreateChatForNote(noteId: String) async throws -> String {
    let url = AuthService.apiURL("/api/notes/\(noteId)/chat")
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.timeoutInterval = 15
    request.applyAuthHeaders()
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
        throw ChatError.fetchFailed
    }
    guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let chatId = json["chatId"] as? String else {
        throw ChatError.fetchFailed
    }
    return chatId
}
```

### 2. Update `NoteDetailScreen` toolbar button

Replace the disabled button with an active one that:
1. Shows a loading state while fetching the chat ID
2. Navigates to the chat on success
3. Shows an error toast on failure (using `ToastPresenter` from the error UX spec)

```swift
// NoteDetailScreen.swift
@State private var isOpeningChat = false

// Toolbar button:
Button {
    Task { await openAssociatedChat() }
} label: {
    if isOpeningChat {
        ProgressView().tint(Color.Hakumi.textPrimary)
    } else {
        Image(systemName: "bubble.left")
    }
}
.disabled(isOpeningChat)

// Action:
private func openAssociatedChat() async {
    isOpeningChat = true
    defer { isOpeningChat = false }
    do {
        autosaveTask?.cancel()
        let chatId = try await ChatService.findOrCreateChatForNote(noteId: id)
        router.sidebarSelection = .chat(id: chatId)
    } catch {
        ToastPresenter.shared.show(.init(message: "Couldn't open chat", style: .error))
    }
}
```

---

## UX Considerations

- **Should the chat include the note content automatically?** The server should seed the chat with a system message or context window that includes the note. This is a server-side concern and out of scope for the iOS client.

- **Should we navigate away from the note, or open the chat in a sheet?** Navigating away (changing `sidebarSelection`) is simpler and consistent with how deep links and the sidebar work. A split-view layout means both can be visible on iPad/Mac.

- **What happens if the user deletes the note?** The associated chat should remain accessible. The server should handle this — the iOS client doesn't need to know about it.

---

## Scope

| File | Change |
|---|---|
| `Services/Chat/ChatService.swift` | Add `findOrCreateChatForNote(noteId:)` |
| `Screens/Notes/NoteDetailScreen.swift` | Un-hide toolbar button, add `openAssociatedChat()` |

---

## Acceptance Criteria

- [ ] API endpoint `/api/notes/:id/chat` exists and returns `{ chatId: string }`
- [ ] Tapping the bubble icon in note detail navigates to the associated chat
- [ ] If no chat exists, one is created and the user is navigated to it
- [ ] Loading state shown while the API call is in flight
- [ ] Failure shows a toast, does not crash
- [ ] Button is not visible until the API is ready (current hidden state is correct)
