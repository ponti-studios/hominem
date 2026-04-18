import SwiftUI

@main
struct HakumiApp: App {
    init() {
        StartupMetrics.mark(.appStart)
        Observability.setup()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .appLifecycleObserver()
                .preferredColorScheme(.dark)
        }
    }
}
