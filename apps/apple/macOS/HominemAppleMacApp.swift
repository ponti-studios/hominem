import HominemAppleCore
import SwiftUI

@main
struct HominemAppleMacApp: App {
    @State private var model = AppModel.live()

    private let backgroundActivity = MacBackgroundActivity()

    var body: some Scene {
        WindowGroup {
            AppRootView(model: model)
                .frame(minWidth: 720, minHeight: 560)
                // Apply screen-sharing protection to every window in this group
                .background(WindowSharingPrivacyView())
        }
        .onAppear {
            backgroundActivity.schedule(coordinator: model.syncCoordinator)
        }
    }
}

// MARK: - macOS Background Activity

/// Schedules a repeating `NSBackgroundActivityScheduler` that triggers the
/// shared sync coordinator approximately every hour. Repeated scheduling is
/// handled by `NSBackgroundActivityScheduler` automatically.
final class MacBackgroundActivity: @unchecked Sendable {
    private var scheduler: NSBackgroundActivityScheduler?

    func schedule(coordinator: AppleSyncCoordinator) {
        let activity = NSBackgroundActivityScheduler(identifier: "io.hominem.apple.mac.sync")
        activity.repeats = true
        activity.interval = 3600 // 1 hour
        activity.tolerance = 600 // 10-minute tolerance
        activity.qualityOfService = .utility

        activity.schedule { completion in
            Task {
                await coordinator.sync()
                completion(.finished)
            }
        }
        scheduler = activity
    }
}

// MARK: - Window screen-sharing protection

/// An invisible `NSViewRepresentable` that sets `sharingType = .none` on its
/// containing window, preventing all screen-sharing and recording tools from
/// capturing the window's contents. Applied in the root `WindowGroup` so every
/// window created for this app inherits the setting.
private struct WindowSharingPrivacyView: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        // Defer until the view has been added to a window
        Task { @MainActor in
            view.window?.sharingType = .none
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        nsView.window?.sharingType = .none
    }
}
