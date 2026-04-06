import HominemAppleCore
import SwiftUI

@main
struct HominemAppleMacApp: App {
    @State private var model = AppModel.live()

    var body: some Scene {
        WindowGroup {
            AppRootView(model: model)
                .frame(minWidth: 720, minHeight: 560)
        }
    }
}
