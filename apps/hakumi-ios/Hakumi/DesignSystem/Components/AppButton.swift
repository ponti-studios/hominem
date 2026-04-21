import SwiftUI

// MARK: - Types

enum ButtonVariant {
    case `default`
    case primary
    case destructive
    case ghost
    case outline
    case link
    case secondary
}

enum ButtonSize {
    case xs, sm, md, lg
    case icon, iconXs, iconSm, iconLg

    var isIcon: Bool {
        switch self {
        case .icon, .iconXs, .iconSm, .iconLg: true
        default: false
        }
    }

    var minHeight: CGFloat {
        switch self {
        case .xs, .iconXs:   28
        case .sm, .iconSm:   36
        case .md, .icon:     44
        case .lg, .iconLg:   48
        }
    }

    var horizontalPadding: CGFloat {
        switch self {
        case .xs:  Spacing.sm
        case .sm:  Spacing.sm2
        case .md:  Spacing.md
        case .lg:  Spacing.lg
        default:   0
        }
    }

    var verticalPadding: CGFloat {
        switch self {
        case .xs:  Spacing.xs
        case .lg:  Spacing.sm2
        default:   Spacing.sm
        }
    }
}

// MARK: - Visual config

private struct ButtonConfig {
    var background: Color
    var foreground: Color
    var border: Color
    var hasBorder: Bool = true
    var underline: Bool = false
}

private func buttonConfig(for variant: ButtonVariant) -> ButtonConfig {
    switch variant {
    case .primary:
        return ButtonConfig(background: Color.Hakumi.black,
                            foreground: Color.Hakumi.white,
                            border: Color.Hakumi.black)
    case .destructive:
        return ButtonConfig(background: Color.Hakumi.destructive,
                            foreground: Color.Hakumi.destructiveForeground,
                            border: Color.Hakumi.destructive)
    case .ghost:
        return ButtonConfig(background: .clear,
                            foreground: Color.Hakumi.textPrimary,
                            border: .clear)
    case .outline:
        return ButtonConfig(background: Color.Hakumi.background,
                            foreground: Color.Hakumi.textPrimary,
                            border: Color.Hakumi.borderDefault)
    case .link:
        return ButtonConfig(background: .clear,
                            foreground: Color.Hakumi.accent,
                            border: .clear,
                            hasBorder: false,
                            underline: true)
    case .default, .secondary:
        return ButtonConfig(background: Color.Hakumi.secondary,
                            foreground: Color.Hakumi.textPrimary,
                            border: Color.Hakumi.borderDefault)
    }
}

// MARK: - AppButton

struct AppButton<Label: View>: View {
    var title: String?
    var variant: ButtonVariant
    var size: ButtonSize
    var isLoading: Bool
    var isDisabled: Bool
    var action: () -> Void
    var label: Label

    private var effectivelyDisabled: Bool { isDisabled || isLoading }
    private var cfg: ButtonConfig { buttonConfig(for: variant) }

    var body: some View {
        Button(action: { action() }) {
            buttonContent
        }
        .buttonStyle(AppButtonPressStyle())
        .disabled(effectivelyDisabled)
        .opacity(effectivelyDisabled ? 0.5 : 1)
    }

    @ViewBuilder
    private var buttonContent: some View {
        Group {
            if size.isIcon {
                iconContent
            } else {
                labelContent
            }
        }
        .frame(minHeight: size.minHeight)
        .background(
            RoundedRectangle(cornerRadius: variant == .link ? 0 : Radii.sm, style: .continuous)
                .fill(cfg.background)
        )
        .overlay(
            cfg.hasBorder && variant != .ghost && variant != .link
            ? RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .strokeBorder(cfg.border, lineWidth: 1)
            : nil
        )
    }

    @ViewBuilder
    private var labelContent: some View {
        HStack(spacing: Spacing.sm) {
            label.foregroundStyle(cfg.foreground)
            if let title {
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .underline(cfg.underline)
                    .foregroundStyle(cfg.foreground)
            }
            if isLoading {
                ProgressView()
                    .tint(cfg.foreground)
                    .scaleEffect(0.75)
            }
        }
        .padding(.horizontal, size.horizontalPadding)
        .padding(.vertical, size.verticalPadding)
    }

    @ViewBuilder
    private var iconContent: some View {
        ZStack {
            if isLoading {
                ProgressView().tint(cfg.foreground).scaleEffect(0.75)
            } else {
                label.foregroundStyle(cfg.foreground)
            }
        }
        .frame(width: size.minHeight, height: size.minHeight)
    }
}

// MARK: - Press style

private struct AppButtonPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(Motion.standard, value: configuration.isPressed)
    }
}

// MARK: - Convenience initialisers

extension AppButton where Label == EmptyView {
    init(_ title: String,
         variant: ButtonVariant = .default,
         size: ButtonSize = .md,
         isLoading: Bool = false,
         isDisabled: Bool = false,
         action: @escaping () -> Void) {
        self.title = title
        self.variant = variant
        self.size = size
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.action = action
        self.label = EmptyView()
    }
}

extension AppButton {
    init(variant: ButtonVariant = .default,
         size: ButtonSize = .md,
         isLoading: Bool = false,
         isDisabled: Bool = false,
         action: @escaping () -> Void,
         @ViewBuilder label: () -> Label) {
        self.title = nil
        self.variant = variant
        self.size = size
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.action = action
        self.label = label()
    }
}

// MARK: - Previews

#Preview("All variants") {
    VStack(spacing: Spacing.sm) {
        AppButton("Default",     variant: .default,     action: {})
        AppButton("Primary",     variant: .primary,     action: {})
        AppButton("Destructive", variant: .destructive, action: {})
        AppButton("Ghost",       variant: .ghost,       action: {})
        AppButton("Outline",     variant: .outline,     action: {})
        AppButton("Link",        variant: .link,        action: {})
        AppButton("Secondary",   variant: .secondary,   action: {})
        AppButton("Loading",     variant: .primary, isLoading: true, action: {})
        AppButton("Disabled",    variant: .primary, isDisabled: true, action: {})
    }
    .padding()
    .background(Color.Hakumi.bgBase)
}

#Preview("Sizes") {
    VStack(spacing: Spacing.sm) {
        AppButton("Extra Small", size: .xs, action: {})
        AppButton("Small",       size: .sm, action: {})
        AppButton("Medium",      size: .md, action: {})
        AppButton("Large",       size: .lg, action: {})
    }
    .padding()
    .background(Color.Hakumi.bgBase)
}

#Preview("Icon button") {
    AppButton(variant: .primary, size: .icon, action: {}) {
        Image(systemName: "plus")
    }
    .padding()
    .background(Color.Hakumi.bgBase)
}
