import SwiftUI

struct ScreenErrorView: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 34))
                .foregroundStyle(Color.Hakumi.textTertiary)
            Text(message)
                .textStyle(AppTypography.footnote)
                .foregroundStyle(Color.Hakumi.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)
            AppButton("Retry", variant: .ghost, size: .sm, action: onRetry)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    ScreenErrorView(message: "Couldn't load notes. Check your connection.", onRetry: {})
        .background(Color.Hakumi.bgBase)
}
