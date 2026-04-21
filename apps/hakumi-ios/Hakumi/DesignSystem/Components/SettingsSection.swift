import SwiftUI

struct SettingsSectionView<Content: View>: View {
    let label: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(label.uppercased())
                .font(.system(size: 12, weight: .medium))
                .tracking(0.4)
                .foregroundStyle(Color.Hakumi.textTertiary)
                .padding(.horizontal, Spacing.xs)

            VStack(spacing: 0) {
                content()
            }
            .cardStyle()
        }
    }
}

struct SettingsDivider: View {
    var body: some View {
        Divider()
            .background(Color.Hakumi.borderSubtle)
            .padding(.leading, Spacing.lg + 20 + Spacing.md)
    }
}

extension View {
    func settingsRow() -> some View {
        self.padding(.horizontal, Spacing.lg)
             .padding(.vertical, Spacing.md)
    }
}

extension Image {
    func settingsIcon() -> some View {
        self
            .font(.system(size: 14))
            .foregroundStyle(Color.Hakumi.textSecondary)
            .frame(width: 20)
    }
}
