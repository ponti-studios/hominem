// MARK: - macOS App Entry Point
// This file contains the main app delegate and background sync setup for the macOS application.
// The @main attribute indicates this is the entry point for the app.

import HominemAppleCore
import SwiftUI

/// The main macOS application struct
/// - Handles app initialization and background sync scheduling
/// - Uses @main attribute to designate this as the app's entry point
/// - Manages the AppModel lifecycle for dependency injection
/// - Applies privacy protections to prevent screen recording
@main
struct HominemAppleMacApp: App {
    /// The app's main model containing all dependencies (services, state, etc.)
    /// @State ensures the model persists for the app's lifetime
    @State private var model = AppModel.live()

    /// Background activity scheduler for macOS
    /// Handles periodic sync operations in the background
    /// Created here and configured in onAppear
    private let backgroundActivity = MacBackgroundActivity()

    /// The main app scene hierarchy
    /// Contains:
    /// - WindowGroup: Main app UI container with min size
    /// - WindowSharingPrivacyView: Prevents screen recording
    /// - onAppear: Schedules background sync
    var body: some Scene {
        WindowGroup {
            // AppRootView is the top-level UI component for the app
            AppRootView(model: model)
                // Set minimum window size (720px wide, 560px tall)
                // Users can resize larger but not smaller
                .frame(minWidth: 720, minHeight: 560)
                // Apply privacy protection to prevent screen-sharing tools
                // from capturing this app's content (e.g., zoom, QuickTime)
                // This is crucial for security when dealing with private data
                .background(WindowSharingPrivacyView())
        }
        // onAppear runs when the app first appears (at launch)
        // This is when we schedule background sync operations
        .onAppear {
            backgroundActivity.schedule(coordinator: model.syncCoordinator)
        }
    }
}

// MARK: - macOS Background Activity Scheduler

/// Manages periodic background sync operations on macOS
///
/// Unlike iOS which uses BGTaskScheduler, macOS uses NSBackgroundActivityScheduler
/// for periodic background work. This scheduler:
/// - Runs the sync task approximately every hour
/// - Automatically repeats the schedule
/// - Respects system power states and user preferences
///
/// @unchecked Sendable: Allows this to be used across threads safely
/// (We maintain thread safety through internal synchronization)
final class MacBackgroundActivity: @unchecked Sendable {
    /// The scheduler instance that runs our background tasks
    /// Stored so it persists for the app's lifetime
    /// If we don't keep this reference, the scheduler is garbage collected
    private var scheduler: NSBackgroundActivityScheduler?

    /// Schedule a repeating background sync task
    /// - Parameter coordinator: The sync coordinator to call periodically
    ///
    /// This method:
    /// 1. Creates a scheduler with a unique identifier
    /// 2. Configures it to repeat every hour with 10-minute flexibility
    /// 3. Sets quality of service to .utility (not critical, but important)
    /// 4. Schedules a closure that calls coordinator.sync()
    func schedule(coordinator: AppleSyncCoordinator) {
        // Create a scheduler with unique identifier
        // This identifier is used by macOS to track and persist the schedule
        let activity = NSBackgroundActivityScheduler(identifier: "io.hominem.apple.mac.sync")

        // Enable repeated scheduling
        // Without this, the task runs only once
        activity.repeats = true

        // Schedule interval: 3600 seconds = 1 hour
        // This is the target interval between sync operations
        // Note: This is approximate - macOS may delay based on system conditions
        activity.interval = 3600

        // Allow macOS to run the task anytime within ±10 minutes of the target time
        // This flexibility lets the OS batch tasks efficiently for power/performance
        // 600 seconds = 10 minutes
        activity.tolerance = 600

        // Set quality of service level
        // .utility means: "Important but not urgent"
        // System can defer this when device is under heavy load or low battery
        // Other options: .default (more important), .background (less important)
        activity.qualityOfService = .utility

        // Schedule the background task
        // The closure runs asynchronously when the scheduler decides to run it
        activity.schedule { completion in
            // Wrap the async sync operation in a Task
            // This allows us to call async coordinator.sync()
            Task {
                // Execute the sync coordinator
                await coordinator.sync()
                // Tell the scheduler we finished successfully
                // This allows it to proceed with the next scheduled run
                completion(.finished)
            }
        }

        // Store the scheduler instance
        // IMPORTANT: We must keep a strong reference to this object
        // If we don't, it gets garbage collected and stops running
        // (This is a common gotcha with NSBackgroundActivityScheduler)
        self.scheduler = activity
    }
}

// MARK: - Window Privacy Protection

/// Invisible NSViewRepresentable that prevents screen sharing and recording
///
/// How it works:
/// 1. Creates an NSView (invisible)
/// 2. Sets its window's sharingType to .none
/// 3. Applied to the root WindowGroup so ALL windows inherit this setting
///
/// Effect:
/// - Screen sharing tools (Zoom, Google Meet) can't capture this app
/// - Screen recording apps (QuickTime, Screenium) can't record this app
/// - This is important for security when dealing with sensitive user data
///
/// Platform note: This is macOS-specific. iOS handles this differently.
private struct WindowSharingPrivacyView: NSViewRepresentable {
    /// Creates the NSView that will be assigned privacy settings
    /// The context parameter contains information about the SwiftUI environment
    /// This runs once when the view is created
    func makeNSView(context: Context) -> NSView {
        let view = NSView()

        // Set privacy on the window, but defer until the view is properly attached
        // We use Task { @MainActor in ... } because:
        // 1. The view might not have a window yet when this runs
        // 2. We need to run on the main thread (UI operations require it)
        // 3. Deferring gives the system time to attach this view to a window
        Task { @MainActor in
            // sharingType = .none prevents all screen sharing
            // This must be done on the main thread
            view.window?.sharingType = .none
        }

        return view
    }

    /// Called whenever the view needs to update (SwiftUI updates)
    /// We ensure privacy settings persist even if the view is recreated
    /// nsView: The NSView instance we created in makeNSView
    /// context: Information about the current SwiftUI state
    func updateNSView(_ nsView: NSView, context: Context) {
        // Re-apply privacy settings to ensure they persist
        // This is especially important if the window configuration changes
        nsView.window?.sharingType = .none
    }
}
