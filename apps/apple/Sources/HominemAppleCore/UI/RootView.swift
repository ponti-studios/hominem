import SwiftUI

public struct AppRootView: View {
    @Bindable private var model: AppModel

    public init(model: AppModel) {
        self.model = model
    }

    public var body: some View {
        NavigationStack {
            Group {
                if model.state.session == nil {
                    SignedOutView(model: model)
                        .accessibilityIdentifier("auth.signedOut")
                } else {
                    ContentView(model: model)
                        .accessibilityIdentifier("auth.signedIn")
                }
            }
            .navigationTitle("")
            .overlay(alignment: .top) {
                if model.state.status == .booting {
                    ProgressView()
                        .padding()
                }
            }
        }
        .background(AppleTheme.background.ignoresSafeArea())
        .task {
            await model.bootIfNeeded()
        }
    }
}
