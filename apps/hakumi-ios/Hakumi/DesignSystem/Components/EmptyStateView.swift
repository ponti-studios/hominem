import SwiftUI

struct EmptyStateView: View {
    let icon: String
    let title: String
    var subtitle: String? = nil
    var action: (label: String, handler: () -> Void)? = nil

    var body: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 36))
                .foregroundStyle(Color.Hakumi.textTertiary)
            VStack(spacing: Spacing.xs) {
                Text(title)
                    .textStyle(AppTypography.headline)
                    .foregroundStyle(Color.Hakumi.textSecondary)
                if let subtitle {
                    Text(subtitle)
                        .textStyle(AppTypography.footnote)
                        .foregroundStyle(Color.Hakumi.textTertiary)
                        .multilineTextAlignment(.center)
                }
            }
            if let action {
                AppButton(action.label, variant: .ghost, size: .sm, action: action.handler)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.lg)
    }
}

#Preview {
    VStack {
        EmptyStateView(
            icon: "note.text",
            title: "No notes yet",
            subtitle: "Tap + to capture your first thought."
        )
        Divider()
        EmptyStateView(
            icon: "magnifyingglass",
            title: "No results",
            subtitle: "Try a different search term.",
            action: ("Clear search", {})
        )
    }
    .background(Color.Hakumi.bgBase)
}
