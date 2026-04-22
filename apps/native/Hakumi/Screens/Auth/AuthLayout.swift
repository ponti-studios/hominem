import SwiftUI

// MARK: - AuthLayout
// Shared layout shell for public auth screens.
// Matches the Expo AuthLayout component: centered card with title, helper, and form area.

struct AuthLayout<Content: View>: View {
    let title: String
    let helper: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                VStack(spacing: 0) {
                    Spacer(minLength: 0)

                    VStack(spacing: Spacing.lg) {
                        VStack(spacing: Spacing.sm) {
                            Text(title)
                                .font(.system(size: 28, weight: .bold))
                                .foregroundStyle(Color.Hakumi.textPrimary)
                                .multilineTextAlignment(.center)
                            Text(helper)
                                .font(.system(size: 15))
                                .foregroundStyle(Color.Hakumi.textTertiary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, Spacing.md)
                        }

                        content()
                    }
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.xl)

                    Spacer(minLength: 0)
                }
                .frame(maxWidth: 420)
                .frame(maxWidth: .infinity)
                .frame(minHeight: proxy.size.height)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color.Hakumi.bgBase)
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
    }

    private var accentBar: some View {
        RoundedRectangle(cornerRadius: Radii.sm)
            .fill(Color.Hakumi.accent.opacity(0.15))
            .frame(width: 48, height: 4)
    }
}
