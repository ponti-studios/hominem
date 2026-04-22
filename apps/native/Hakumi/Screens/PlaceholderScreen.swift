import SwiftUI

// Thin placeholder used for every route during Phase 1.
// Phase 2+ replaces each call site with the real screen view.

struct PlaceholderScreen: View {
    let title: String
    var icon: String = "rectangle.dashed"

    var body: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundStyle(Color.Hakumi.textTertiary)
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.Hakumi.textPrimary)
            Text("Coming in a later phase")
                .font(.system(size: 13))
                .foregroundStyle(Color.Hakumi.textTertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .safeAreaPadding(.top, Spacing.xl)
        .safeAreaPadding(.horizontal, Spacing.lg)
        .background(Color.Hakumi.bgBase)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Error / not-found

struct ErrorScreen: View {
    var body: some View {
        PlaceholderScreen(title: "Error", icon: "exclamationmark.triangle")
    }
}

struct NotFoundScreen: View {
    var body: some View {
        PlaceholderScreen(title: "Not Found", icon: "questionmark.circle")
    }
}

