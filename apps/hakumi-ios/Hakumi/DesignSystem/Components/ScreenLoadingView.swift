import SwiftUI

struct ScreenLoadingView: View {
    var body: some View {
        VStack {
            Spacer()
            ProgressView().tint(Color.Hakumi.textTertiary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    ScreenLoadingView()
        .background(Color.Hakumi.bgBase)
}
