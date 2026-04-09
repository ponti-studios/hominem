import SwiftUI

// MARK: - Notification names (cross-platform)

public extension Notification.Name {
    static let hominemNewNote = Notification.Name("io.hominem.apple.newNote")
    static let hominemNewChat = Notification.Name("io.hominem.apple.newChat")
    static let hominemFocusSearch = Notification.Name("io.hominem.apple.focusSearch")
}

// MARK: - Sidebar selection (cross-platform — macOS uses it in the split view)

public enum MacSidebarSelection: String, CaseIterable, Identifiable, Hashable, Sendable {
    case feed = "Feed"
    case notes = "Notes"
    case chat = "Chat"
    case settings = "Settings"

    public var id: String { rawValue }

    public var icon: String {
        switch self {
        case .feed: "house"
        case .notes: "note.text"
        case .chat: "bubble.left.and.bubble.right"
        case .settings: "gearshape"
        }
    }
}

// MARK: - macOS-only keyboard shortcut modifier

#if os(macOS)

/// Attaches macOS keyboard shortcuts to the navigation split view.
///
/// - `⌘,` → jump to Settings
/// - `⌘N` → new note or new chat (depends on the active sidebar selection)
struct MacKeyboardShortcuts: ViewModifier {
    let model: AppModel
    @Binding var selection: MacSidebarSelection?

    func body(content: Content) -> some View {
        content
            // ⌘, → Settings
            .background(
                Button("") { selection = .settings }
                    .keyboardShortcut(",", modifiers: .command)
                    .hidden()
            )
            // ⌘N → context-aware new item
            .background(
                Button("") { handleNewItem() }
                    .keyboardShortcut("n", modifiers: .command)
                    .hidden()
            )
    }

    private func handleNewItem() {
        switch selection {
        case .chat:
            NotificationCenter.default.post(name: .hominemNewChat, object: nil)
        default:
            NotificationCenter.default.post(name: .hominemNewNote, object: nil)
        }
    }
}

extension View {
    func macKeyboardShortcuts(model: AppModel, selection: Binding<MacSidebarSelection?>) -> some View {
        modifier(MacKeyboardShortcuts(model: model, selection: selection))
    }
}

#endif
