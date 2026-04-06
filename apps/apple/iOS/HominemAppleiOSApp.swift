import HominemAppleCore
import SwiftUI

@main
struct HominemAppleiOSApp: App {
    @State private var model = AppModel.live()

    var body: some Scene {
        WindowGroup {
            AppRootView(model: model)
        }
    }
}
