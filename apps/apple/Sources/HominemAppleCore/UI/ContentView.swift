import SwiftUI

/// Root navigation shell shown when the user is signed in.
///
/// - iOS: `TabView` with Feed, Notes, Chat, and Settings tabs.
/// - macOS: `NavigationSplitView` with a sidebar list and a bound detail pane.
///
/// App-lock is enforced by `AppLockOverlay` which sits above this view.
public struct ContentView: View {
    let model: AppModel

    public init(model: AppModel) {
        self.model = model
    }

    public var body: some View {
        Group {
            #if os(iOS)
            iOSTabView
            #else
            macOSSplitView
            #endif
        }
        .overlay {
            if case .locked = model.appLock.state {
                AppLockOverlay(appLock: model.appLock)
                    .transition(.opacity)
            } else if case .authenticating = model.appLock.state {
                AppLockOverlay(appLock: model.appLock)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: model.appLock.state == .unlocked)
        .onReceive(NotificationCenter.default.publisher(for: willEnterForegroundNotification)) { _ in
            model.appLock.engageLockIfNeeded()
        }
    }

    // MARK: - Platform foreground notification

    private var willEnterForegroundNotification: Notification.Name {
        #if os(iOS)
        UIApplication.willEnterForegroundNotification
        #else
        NSApplication.willBecomeActiveNotification
        #endif
    }

    // MARK: - iOS

    private var iOSTabView: some View {
        TabView {
            NavigationStack {
                FeedView(feedViewModel: model.feedViewModel)
            }
            .tabItem { Label("Feed", systemImage: "house") }

            NavigationStack {
                NotesListView(notesStore: model.notesStore)
            }
            .tabItem { Label("Notes", systemImage: "note.text") }

            NavigationStack {
                ChatsListView(
                    chatsStore: model.chatsStore,
                    voiceService: model.voiceService,
                    ttsPlayer: model.ttsPlayer
                )
            }
            .tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right") }

            NavigationStack {
                SettingsView(model: model)
            }
            .tabItem { Label("Settings", systemImage: "gearshape") }
        }
        .tint(AppleTheme.accent)
    }

    // MARK: - macOS

    #if os(macOS)
    @ViewBuilder
    private var macOSSplitView: some View {
        MacSplitView(model: model)
    }
    #endif
}

// MARK: - macOS split view

#if os(macOS)
private struct MacSplitView: View {
    let model: AppModel
    @State private var selection: MacSidebarSelection? = .feed

    var body: some View {
        NavigationSplitView {
            List(MacSidebarSelection.allCases, selection: $selection) { item in
                Label(item.rawValue, systemImage: item.icon)
                    .tag(item)
            }
            .listStyle(.sidebar)
            .navigationTitle("Hominem")
        } detail: {
            detailView(for: selection ?? .feed)
        }
        .navigationSplitViewStyle(.balanced)
        .macKeyboardShortcuts(model: model, selection: $selection)
    }

    @ViewBuilder
    private func detailView(for item: MacSidebarSelection) -> some View {
        switch item {
        case .feed:
            NavigationStack {
                FeedView(feedViewModel: model.feedViewModel)
            }
        case .notes:
            NavigationStack {
                NotesListView(notesStore: model.notesStore)
            }
        case .chat:
            NavigationStack {
                ChatsListView(
                    chatsStore: model.chatsStore,
                    voiceService: model.voiceService,
                    ttsPlayer: model.ttsPlayer
                )
            }
        case .settings:
            NavigationStack {
                SettingsView(model: model)
            }
        }
    }
}
#endif
