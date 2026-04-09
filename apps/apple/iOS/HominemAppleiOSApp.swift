import BackgroundTasks
import HominemAppleCore
import SwiftUI

@main
struct HominemAppleiOSApp: App {
    @State private var model = AppModel.live()

    // MARK: - Background task identifier

    private static let syncTaskIdentifier = "io.hominem.apple.ios.sync"

    var body: some Scene {
        WindowGroup {
            AppRootView(model: model)
        }
        // Handle the background app-refresh task via the SwiftUI scene API
        .backgroundTask(.appRefresh(Self.syncTaskIdentifier)) {
            await model.syncCoordinator.sync()
            scheduleiOSBackgroundRefresh()
        }
    }

    init() {
        // Register the background task handler before the app finishes launching.
        // The identifier must match BGTaskSchedulerPermittedIdentifiers in Info.plist.
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.syncTaskIdentifier,
            using: nil
        ) { task in
            guard let refreshTask = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            let syncTask = Task {
                await model.syncCoordinator.sync()
                scheduleiOSBackgroundRefresh()
                refreshTask.setTaskCompleted(success: true)
            }
            refreshTask.expirationHandler = {
                syncTask.cancel()
            }
        }

        // Submit the initial background refresh request on app launch
        // so the system knows to schedule periodic sync tasks
        scheduleiOSBackgroundRefresh()
    }
}

// MARK: - Scheduling

/// Request the next background refresh from the system scheduler.
/// Call this after each background execution attempt (success or failure).
@MainActor
private func scheduleiOSBackgroundRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: HominemAppleiOSApp.syncTaskIdentifier)
    // Ask for a refresh no sooner than one hour from now
    request.earliestBeginDate = Date(timeIntervalSinceNow: 3600)
    try? BGTaskScheduler.shared.submit(request)
}
