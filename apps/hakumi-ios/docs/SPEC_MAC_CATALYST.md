# Spec: Mac Catalyst Polish

**Status:** Proposed  
**Priority:** Medium  
**Effort:** Medium (3–5 days)  
**Dependencies:** None

---

## Problem

`SUPPORTS_MACCATALYST: YES` is set in the build config, so the app runs on macOS. However, the current implementation was built for iPhone/iPad interaction patterns. Several areas need explicit attention to feel native on Mac:

1. **Sidebar width** — `NavigationSplitView` sidebar has no explicit width constraint; on Mac it may be too narrow or too wide
2. **Keyboard shortcuts** — No `Button` uses `.keyboardShortcut()`; common actions (new note, send message, search) have no keyboard binding
3. **Context menus** — Swipe actions don't translate to Mac; right-click should produce a context menu
4. **Composer card** — The `safeAreaInset` bottom composer is appropriate on iPhone but looks odd as a fixed-bottom bar on a wide Mac window
5. **`AVAudioSession` guards** — Already wrapped in `#if !targetEnvironment(macCatalyst)` but should be verified
6. **Window size** — No minimum window size is set; the app can be resized to unusably small widths
7. **Toolbar items** — iOS-style `.navigationBarTrailing` toolbar items may not position correctly on macOS
8. **Hover effects** — List rows don't show hover highlighting on Mac
9. **Text cursor** — `TextField` and `TextEditor` already work, but focus ring styling should be verified
10. **Title bar** — The hidden navigation bar styling (`toolbarBackgroundVisibility(.hidden)`) may produce incorrect behavior on Mac

---

## Goal

Make the Mac experience feel intentional rather than accidental. Focus on the interactions users will notice first:
- Keyboard shortcuts for the most common actions
- Right-click context menus replacing swipe actions  
- Correct sidebar width behavior
- Minimum window size

Deeper Mac-native features (menu bar integration, Touch Bar, etc.) are out of scope for this pass.

---

## Proposed Changes

### 1. Minimum window size

In `HakumiApp.swift` (or wherever `WindowGroup` is configured), set a minimum window size:

```swift
WindowGroup {
    RootView()
}
.defaultSize(width: 900, height: 600)
.windowResizability(.contentMinSize)
```

Or via `UIWindowScene` delegate:

```swift
#if targetEnvironment(macCatalyst)
scene.sizeRestrictions?.minimumSize = CGSize(width: 800, height: 550)
#endif
```

### 2. Sidebar column width

In `RootView.protectedShell`, set explicit column widths on `NavigationSplitView`:

```swift
NavigationSplitView(columnVisibility: $columnVisibility) {
    SidebarView()
} detail: {
    ...
}
.navigationSplitViewColumnWidth(min: 240, ideal: 280, max: 360)  // sidebar column
```

### 3. Keyboard shortcuts

Add `.keyboardShortcut` to the most common actions:

```swift
// New note (⌘N)
Button { Task { await createAndOpenNote() } } label: { ... }
    .keyboardShortcut("n", modifiers: .command)

// Search (⌘F)  
Button { searchQuery = "" } label: { ... }
    .keyboardShortcut("f", modifiers: .command)

// Send message (⌘Return)
Button { Task { await composerState.submitPrimary(router: router) } } label: { ... }
    .keyboardShortcut(.return, modifiers: .command)

// Archive (⌘⌫ or ⌘E for archive — follow Mail.app convention)
```

### 4. Context menus replacing swipe actions

Swipe actions are invisible on Mac. Add `.contextMenu` to sidebar rows and note rows in parallel with the existing swipe actions (`.swipeActions` is still correct for iPhone/iPad):

```swift
.contextMenu {
    Button("Archive", systemImage: "archivebox") {
        Task { await AppStores.shared.archiveNote(id: item.id) }
    }
    Button("Delete", systemImage: "trash", role: .destructive) {
        Task { await AppStores.shared.deleteNote(id: item.id) }
    }
}
```

Both `.swipeActions` and `.contextMenu` can coexist — SwiftUI handles platform dispatch correctly.

### 5. Composer layout on Mac

The `safeAreaInset(edge: .bottom)` composer card works on iPhone but creates a floating bar over the content on wider Mac windows. On Mac, the composer should be integrated differently — either:

**Option A:** Keep `safeAreaInset` but add a Mac-specific max-width and horizontal padding:
```swift
.safeAreaInset(edge: .bottom, spacing: 0) {
    SharedComposerCard(target: composerState.target)
        .frame(maxWidth: 800)  // prevent it spanning a full-width Mac window
        .padding(.horizontal, isMacCatalyst ? Spacing.xl : 0)
}
```

**Option B:** On Mac, move the composer inside the detail column's `VStack` rather than as a `safeAreaInset`. More work, better result.

Recommend Option A for this pass.

```swift
private var isMacCatalyst: Bool {
    #if targetEnvironment(macCatalyst)
    return true
    #else
    return false
    #endif
}
```

### 6. Hover effects on list rows

Add `.hoverEffect(.highlight)` to clickable rows (iOS 17+, works on Mac Catalyst):

```swift
// SidebarRow, NoteRowView, InboxRowView
.hoverEffect(.highlight)
```

This gives Mac users visual feedback on hover, matching standard Mac list behavior.

### 7. Toolbar positioning

Review all `.toolbar { ToolbarItem(placement: .topBarTrailing) }` calls. On Mac Catalyst, `.topBarTrailing` maps to the window toolbar area, which is usually correct. However `.navigationBarTitleDisplayMode(.inline)` has no effect on Mac and should be wrapped:

```swift
#if !targetEnvironment(macCatalyst)
.navigationBarTitleDisplayMode(.inline)
#endif
```

Or set it unconditionally and accept that it's a no-op on Mac.

---

## Platform Detection Helper

To avoid `#if targetEnvironment(macCatalyst)` scattered through view code, add a single location:

```swift
// Environment+Platform.swift
extension EnvironmentValues {
    var isMacCatalyst: Bool {
        #if targetEnvironment(macCatalyst)
        return true
        #else
        return false
        #endif
    }
}

// Usage in views:
@Environment(\.isMacCatalyst) private var isMacCatalyst
```

---

## Testing Approach

Mac Catalyst testing requires running on a Mac (simulator or device). Key things to manually verify:

- [ ] App launches on macOS 15 without crash
- [ ] Sidebar is usable at default window size
- [ ] Window cannot be resized smaller than minimum
- [ ] ⌘N creates a new note
- [ ] Right-click on a sidebar row shows archive/delete options
- [ ] Composer card doesn't span the full window width
- [ ] `AVAudioSession` guard prevents crash on Mac (voice input gracefully disabled)

---

## Scope

| File | Change |
|---|---|
| `HakumiApp.swift` | Set `defaultSize` and `windowResizability` |
| `Navigation/RootView.swift` | `navigationSplitViewColumnWidth`, Mac composer padding |
| `Screens/Sidebar/SidebarView.swift` | Add `.contextMenu`, `.keyboardShortcut("n")`, `.hoverEffect` |
| `Screens/Notes/NotesScreen.swift` | Add `.contextMenu`, `.hoverEffect` |
| `Screens/Chat/ChatScreen.swift` | Add `.keyboardShortcut(.return)` for send |
| `Extensions/Environment+Platform.swift` | New — `isMacCatalyst` environment value |

---

## Out of Scope

- macOS-native menu bar commands (`Commands { }`)
- Touch Bar support
- Mac-specific settings pane (uses `Form` already — acceptable for v1)
- macOS window tabbing

---

## Acceptance Criteria

- [ ] App runs on macOS 15 without crash or obvious layout breakage
- [ ] Minimum window size enforced
- [ ] Sidebar width is appropriate at default and resized widths
- [ ] ⌘N, ⌘F, ⌘Return shortcuts work
- [ ] Right-click context menus show archive/delete on list rows
- [ ] Composer card has reasonable width on wide Mac windows
- [ ] Voice input gracefully unavailable on Mac (no crash, microphone button hidden)
