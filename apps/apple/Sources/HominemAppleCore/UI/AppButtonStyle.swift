import SwiftUI

enum AppButtonVariant {
    case standard
    case link
    case destructiveOutline
    case destructiveLink
}

struct AppButtonStyle: ButtonStyle {
    let variant: AppButtonVariant
    let fullWidth: Bool

    init(_ variant: AppButtonVariant, fullWidth: Bool = false) {
        self.variant = variant
        self.fullWidth = fullWidth
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(variant.isLink ? AppleTheme.captionFont : AppleTheme.buttonFont)
            .underline(variant.isLink)
            .foregroundStyle(foregroundColor)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .frame(minHeight: variant.isLink ? nil : 44)
            .padding(.horizontal, variant.isLink ? 0 : AppleTheme.md)
            .padding(.vertical, variant.isLink ? 0 : AppleTheme.sm)
            .background(background)
            .overlay(
                RoundedRectangle(cornerRadius: AppleTheme.controlRadius, style: .continuous)
                    .stroke(borderColor, lineWidth: variant.isLink ? 0 : 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: AppleTheme.controlRadius, style: .continuous))
            .opacity(configuration.isPressed ? 0.85 : 1)
    }

    private var foregroundColor: Color {
        switch variant {
        case .standard:
            AppleTheme.foreground
        case .link:
            AppleTheme.tertiaryText
        case .destructiveOutline, .destructiveLink:
            AppleTheme.destructive
        }
    }

    private var background: Color {
        switch variant {
        case .standard:
            AppleTheme.secondaryFill
        case .link, .destructiveLink:
            .clear
        case .destructiveOutline:
            AppleTheme.background
        }
    }

    private var borderColor: Color {
        switch variant {
        case .standard:
            AppleTheme.border
        case .link, .destructiveLink:
            .clear
        case .destructiveOutline:
            AppleTheme.destructive
        }
    }
}

private extension AppButtonVariant {
    var isLink: Bool {
        switch self {
        case .link, .destructiveLink:
            true
        case .standard, .destructiveOutline:
            false
        }
    }
}
