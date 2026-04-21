# Spec: Offline / Error UX

**Status:** Proposed  
**Priority:** Medium  
**Effort:** Medium (3–5 days)  
**Dependencies:** None

---

## Problem

Several user-facing actions fail silently or provide misleading feedback:

| Action | Current behavior | Expected behavior |
|---|---|---|
| Create note (toolbar button) | Empty catch — user sees nothing | Show alert or inline error |
| Create note from sidebar | Same | Same |
| Archive/delete (swipe action) | Row disappears; if API fails, it reappears at top with no explanation | Row reappears in original position with a brief error toast |
| Chat message send | Error string shown but only clears on retry or edit — no persistent indication | Error badge on the failed message with a retry tap target |
| Note autosave | Silent on failure | Indicator in toolbar (e.g., "Not saved") |
| Initial list load failure | Full-screen error with Retry button — ✓ good | No change needed |
| Pull-to-refresh failure | Silently ignores error | Show a non-blocking banner |

Additionally, the app has no concept of network reachability. If the device goes offline mid-session, the user only discovers this when an action fails.

---

## Goal

Make failures visible, actionable, and non-blocking. Users should always know:
1. Whether their action succeeded
2. If it failed, why (in plain language)
3. How to retry

Do not add loading spinners or error states that break the visual flow for operations that are usually instant.

---

## Proposed Solutions

### 1. Toast / snack bar component

A lightweight, auto-dismissing banner for non-blocking feedback. Used for transient success/failure notifications.

```swift
struct ToastMessage: Equatable {
    enum Style { case error, success, info }
    let message: String
    let style: Style
    var duration: TimeInterval = 3
}

// Environment-based presenter
@Observable final class ToastPresenter {
    static let shared = ToastPresenter()
    private(set) var current: ToastMessage? = nil

    func show(_ message: ToastMessage) {
        current = message
        Task {
            try? await Task.sleep(for: .seconds(message.duration))
            if current == message { current = nil }
        }
    }
}
```

`RootView` overlays `ToastView` at the top of the screen, driven by `ToastPresenter.shared`.

**Usage:**
```swift
} catch {
    ToastPresenter.shared.show(.init(message: "Couldn't create note", style: .error))
}
```

### 2. Failed message retry in `ChatScreen`

When a message send fails, the message should appear in the list with an error indicator:

- Add the message to the local list immediately (optimistic) with a `sendFailed: Bool` flag
- If the API call fails, mark `sendFailed = true`
- Render failed messages with a red badge and "Tap to retry" affordance
- On tap, retry the send

This is the standard pattern used by iMessage, WhatsApp, and Slack.

```swift
// ChatMessage extension
var isFailed: Bool { ... }  // local-only state, not from server
```

Since `ChatMessage` comes from the server, failed messages are tracked separately in `ChatScreen` state:
```swift
@State private var failedMessageIds: Set<String> = []
```

### 3. Autosave indicator in `NoteDetailScreen`

The note detail already calls `NoteService.updateNote` in `scheduleAutosave`. Add a small status indicator to the toolbar:

- Default: nothing visible
- Saving: subtle "Saving…" text in `.textTertiary`
- Saved: brief "Saved" with checkmark, fades out after 2 seconds
- Failed: "Not saved" in `.destructive` with a retry tap target

```swift
enum SaveState { case idle, saving, saved, failed(String) }
@State private var saveState: SaveState = .idle
```

### 4. Pull-to-refresh error banner

`SidebarView`, `NotesScreen` — when pull-to-refresh fails, show a dismissible banner below the navigation bar:

```swift
.refreshable {
    do { try await store.fetch() }
    catch { refreshError = error.localizedDescription }
}
// Banner shown when refreshError != nil
```

### 5. Offline awareness (stretch goal)

Monitor `NWPathMonitor` in a lightweight `NetworkMonitor` service. When the path becomes unsatisfied, show a persistent offline banner. When it returns, auto-retry the last failed fetch.

```swift
@Observable final class NetworkMonitor {
    static let shared = NetworkMonitor()
    private(set) var isConnected = true
    // NWPathMonitor observing .satisfied
}
```

This is optional for the initial implementation — the toast approach handles the immediate problem without requiring network state tracking.

---

## Design Tokens Needed

- `Color.Hakumi.toastBackground` (or reuse `bgSurface` + shadow)
- `Color.Hakumi.toastError` (or reuse `destructive`)
- `Color.Hakumi.toastSuccess` (or reuse `accent`)

If these don't exist in the design system, they should be added rather than using hardcoded colors.

---

## Scope

| Component | Change |
|---|---|
| `DesignSystem/Components/ToastView.swift` | New — toast banner view |
| `Services/UI/ToastPresenter.swift` | New — `@Observable` presenter singleton |
| `Navigation/RootView.swift` | Add toast overlay |
| `Screens/Notes/NotesScreen.swift` | Use `ToastPresenter` in `createAndOpen()` error path |
| `Screens/Sidebar/SidebarView.swift` | Use `ToastPresenter` in `createAndOpenNote()` error path |
| `Screens/Chat/ChatScreen.swift` | Failed message retry UX |
| `Screens/Notes/NoteDetailScreen.swift` | Autosave indicator |
| `Screens/Sidebar/SidebarView.swift` | Pull-to-refresh error banner |
| `Services/Network/NetworkMonitor.swift` | New — stretch goal only |

---

## Open Questions

- **Should `ToastPresenter` be environment-injected or a singleton?**  
  Singleton is simpler and appropriate here — toasts are global UI, not per-view. Can be injected for testing if needed later.

- **For failed chat messages: should they persist after app relaunch?**  
  No. Failed messages are ephemeral local state. Only server-confirmed messages are shown after relaunch.

- **Should the autosave indicator use the existing `ProgressView` or a custom animation?**  
  Use a `ProgressView` in toolbar during save, then a checkmark SF Symbol that fades out. No custom animation needed.

---

## Acceptance Criteria

- [ ] Note creation failure shows a dismissible alert
- [ ] Swipe-archive failure shows a toast; item restored to original position (done — rollback fixed)
- [ ] Failed chat messages show a retry affordance
- [ ] Note autosave failure shows "Not saved" in the toolbar
- [ ] Pull-to-refresh failure shows a non-blocking banner
- [ ] All toast messages auto-dismiss after 3 seconds
- [ ] Toast messages are accessible (VoiceOver announces them)
