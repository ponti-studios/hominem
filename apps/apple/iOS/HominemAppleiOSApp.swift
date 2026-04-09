// MARK: - iOS App Entry Point
// This file contains the main app delegate and background sync setup for the iOS application.
// The @main attribute indicates this is the entry point for the app.

import BackgroundTasks
import HominemAppleCore
import SwiftUI

/// The main iOS application struct
/// - Handles app initialization and background sync scheduling
/// - Uses @main attribute to designate this as the app's entry point
/// - Manages the AppModel lifecycle for dependency injection
@main
struct HominemAppleiOSApp: App {
    /// The app's main model containing all dependencies (services, state, etc.)
    /// @State ensures the model persists for the app's lifetime
    @State private var model = AppModel.live()

    // MARK: - Background Task Configuration

    /// Unique identifier for the background app refresh task
    /// This must match the identifier in Info.plist's BGTaskSchedulerPermittedIdentifiers
    /// Format: "io.hominem.apple.ios.sync" (reverse domain notation + action)
    private static let syncTaskIdentifier = "io.hominem.apple.ios.sync"

    /// The main app scene hierarchy
    /// Contains:
    /// - WindowGroup: Main app UI container
    /// - backgroundTask: Async task handler for background app refresh
    var body: some Scene {
        WindowGroup {
            // AppRootView is the top-level UI component for the app
            // It receives the model for dependency injection
            AppRootView(model: model)
        }
        // Handle background app-refresh tasks (periodic sync in the background)
        // This is triggered by iOS when the system decides to run background app refresh
        // The closure automatically handles task expiration if we take too long
        .backgroundTask(.appRefresh(Self.syncTaskIdentifier)) {
            // Execute the sync operation asynchronously
            await model.syncCoordinator.sync()
            // Schedule the next background refresh after this one completes
            scheduleiOSBackgroundRefresh()
        }
    }

    /// App initializer - runs once when the app launches
    /// Sets up background task handling and schedules the first sync
    /// This is called before the body is evaluated
    init() {
        // MARK: Register Background Task Handler
        // This must happen in init() before app finishes launching
        // The identifier must match one in Info.plist's BGTaskSchedulerPermittedIdentifiers
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.syncTaskIdentifier,
            using: nil
        ) { task in
            // Type-check that we received the correct task type
            // BGAppRefreshTask is used for periodic background app refresh
            guard let refreshTask = task as? BGAppRefreshTask else {
                // Mark task as failed if we got an unexpected type
                task.setTaskCompleted(success: false)
                return
            }

            // Create an async task to perform the sync
            let syncTask = Task {
                // Execute the sync operation on the background thread
                await model.syncCoordinator.sync()

                // Schedule the next background refresh after this one completes
                // This keeps the periodic sync cycle going
                scheduleiOSBackgroundRefresh()

                // Mark the task as completed successfully
                // This tells iOS the task finished and managed its resources properly
                refreshTask.setTaskCompleted(success: true)
            }

            // Handle task expiration gracefully
            // If iOS kills the task (e.g., app takes too long), cancel our sync
            // This prevents resource leaks and respects system constraints
            refreshTask.expirationHandler = {
                syncTask.cancel()
            }
        }

        // MARK: Schedule Initial Background Refresh
        // Request the first background refresh when the app launches
        // This tells iOS that the app wants periodic background execution
        // iOS will then schedule periodic refreshes when appropriate (low power state, WiFi, etc.)
        scheduleiOSBackgroundRefresh()
    }
}

// MARK: - Background Refresh Scheduling

/// Requests the next background app refresh from the system scheduler
///
/// This function should be called:
/// - Once at app launch (in init())
/// - After each background sync attempt (in backgroundTask closure)
/// - Whenever the sync schedule changes
///
/// How it works:
/// 1. Creates a BGAppRefreshTaskRequest with our sync identifier
/// 2. Sets an earliest start time (1 hour from now)
/// 3. Submits it to the system scheduler
/// 4. iOS will schedule the actual refresh when conditions are met (battery low, WiFi available, etc.)
///
/// @MainActor ensures this runs on the main thread (required by BGTaskScheduler)
/// try? suppresses errors because submission failures are non-fatal
@MainActor
private func scheduleiOSBackgroundRefresh() {
    /// Create a background refresh task request
    /// This tells iOS we want periodic background execution
    let request = BGAppRefreshTaskRequest(identifier: HominemAppleiOSApp.syncTaskIdentifier)

    /// Set the minimum wait before this task can run
    /// We want at least 1 hour between sync attempts to avoid battery drain
    /// 3600 seconds = 1 hour
    /// Note: This is a minimum - iOS may delay further based on battery/network conditions
    request.earliestBeginDate = Date(timeIntervalSinceNow: 3600)

    /// Submit the request to iOS's background task scheduler
    /// try? ignores submission errors (harmless if it fails, system will retry)
    try? BGTaskScheduler.shared.submit(request)
}
