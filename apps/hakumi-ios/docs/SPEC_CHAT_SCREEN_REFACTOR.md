# Spec: ChatScreen Decomposition

**Status:** Proposed  
**Priority:** Medium  
**Effort:** Medium (2–4 days)  
**Dependencies:** None (can be done incrementally)

---

## Problem

`ChatScreen.swift` is the most complex view in the codebase. It contains:
- Message list rendering (user bubbles, assistant bubbles, tool call rows, thinking rows)
- Edit message sheet
- Review/save-to-notes sheet
- In-screen search bar
- Scroll-to-bottom logic
- Archive/title-edit actions
- Chat loading, reload, and error state
- `~10` `@State` variables after the previous refactor

Everything lives in one file. This creates three concrete problems:

1. **No individual previewability.** You cannot preview a single message bubble, the thinking row, or the tool call UI in isolation. Every preview requires a full chat with messages.

2. **Hard to reason about.** When a bug is reported in the message bubble styling, you have to navigate a 600+ line file to find it.

3. **Will only get worse.** Chat is the feature most likely to grow — reactions, voice messages, image previews, citations, multi-step tool calls. Each addition makes the file larger.

---

## Goal

Split `ChatScreen` into composable sub-views without changing any visible behavior. Each sub-view should be independently previewable and have a clearly bounded responsibility.

---

## Proposed Structure

```
Screens/Chat/
  ChatScreen.swift              — orchestration only: state, data loading, sheet presentation
  ChatMessageList.swift         — ScrollView + ForEach over messages, scroll-to-bottom logic
  ChatBubbleView.swift          — single message bubble (user or assistant)
  ChatToolCallRow.swift         — tool/function call display row
  ChatThinkingRow.swift         — animated "thinking" indicator row (already partially isolated?)
  ChatEditSheet.swift           — edit message sheet content
  ChatReviewSheet.swift         — save-to-notes sheet content
  ChatSearchBar.swift           — in-screen search bar + filtering
```

---

## Decomposition Plan

### `ChatBubbleView`

Owns: bubble shape, text content, timestamp, role-based styling, selection state.

```swift
struct ChatBubbleView: View {
    let message: ChatMessage
    let isSelected: Bool
    let onLongPress: () -> Void

    var body: some View { ... }
}

#Preview {
    VStack {
        ChatBubbleView(message: .fixtures[0], isSelected: false, onLongPress: {})
        ChatBubbleView(message: .fixtures[1], isSelected: true, onLongPress: {})
    }
    .padding()
    .background(Color.Hakumi.bgBase)
}
```

### `ChatToolCallRow`

Owns: tool call name display, arguments/result collapsible section, loading state.

```swift
struct ChatToolCallRow: View {
    let message: ChatMessage  // role == .tool
    var body: some View { ... }
}
```

### `ChatThinkingRow`

Owns: animated dots or waveform while `sendingChatId` matches the current chat.

```swift
struct ChatThinkingRow: View {
    var body: some View { ... }
}
```

### `ChatMessageList`

Owns: the `ScrollView`, `ForEach` over messages, scroll position tracking, scroll-to-bottom, `isNearBottom` state.

```swift
struct ChatMessageList: View {
    let messages: [ChatMessage]
    let isSending: Bool
    let onLongPress: (ChatMessage) -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(messages) { msg in
                        // route to bubble, tool call row, or thinking row
                    }
                    Color.clear.frame(height: 1).id("chat-bottom")
                }
            }
            // scroll-to-bottom logic lives here
        }
    }
}
```

### `ChatEditSheet` and `ChatReviewSheet`

These are currently inline `@ViewBuilder` properties. Extracting them to separate structs makes the sheet content independently previewable and removes ~80 lines from `ChatScreen.body`.

```swift
struct ChatEditSheet: View {
    @Binding var text: String
    let onSave: () -> Void
    let onCancel: () -> Void
}

struct ChatReviewSheet: View {
    @Binding var draft: ChatScreen.ReviewDraft?
    let onSave: (String, String) async -> Void
}
```

### `ChatSearchBar`

The in-screen search bar and `displayMessages` filtering can move here.

```swift
struct ChatSearchBar: View {
    @Binding var query: String?
    var body: some View { ... }
}
```

### `ChatScreen` after decomposition

Reduced to:
- `@State` variables and data loading
- Sheet presentation bindings
- Toolbar items
- Composing the sub-views

---

## Migration Strategy

Do this incrementally — one sub-view per PR:

1. `ChatThinkingRow` — already nearly isolated, lowest risk
2. `ChatToolCallRow` — self-contained display
3. `ChatBubbleView` — most impactful for preview value
4. `ChatEditSheet` + `ChatReviewSheet` — removes the most lines from `ChatScreen`
5. `ChatMessageList` — scroll logic, highest complexity
6. `ChatSearchBar` — last, smallest

Each step should leave `ChatScreen` compiling and passing tests before the next begins.

---

## Open Questions

- **Should `ChatMessageList` own `isNearBottom` state or should `ChatScreen` own it?**  
  Recommend `ChatMessageList` owns it — it is purely a scroll concern. `ChatScreen` only needs to call `scrollToBottom()` when sending.

- **How to handle the `activeMessageId` (long-press selection) state?**  
  Keep it in `ChatScreen` — it drives the `confirmationDialog` which is a `ChatScreen`-level concern. Pass it down as a binding or callback.

- **`ChatReviewSheet` calls `NoteService.createNote` — should it?**  
  No. The save action should be passed in as a closure from `ChatScreen`. The sheet owns only UI state.

---

## Acceptance Criteria

- [ ] `ChatBubbleView` renders correctly in preview for `.user`, `.assistant`, and `.tool` roles
- [ ] `ChatThinkingRow` previews without a running app
- [ ] `ChatEditSheet` previews in saved and saving states
- [ ] `ChatScreen.swift` is under 300 lines after decomposition
- [ ] No behavior changes — existing functionality is identical
- [ ] All existing `ChatScreen` tests still pass
