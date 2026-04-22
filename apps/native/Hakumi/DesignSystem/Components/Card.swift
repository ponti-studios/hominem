import SwiftUI

// MARK: - Card compound views
// Source: apps/mobile/components/ui/Card.tsx

struct Card<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            content()
        }
        .padding(.vertical, Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(Color.Hakumi.bgSurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
        )
    }
}

struct CardHeader<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            content()
        }
        .padding(.horizontal, Spacing.lg)
    }
}

struct CardTitle: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(Color.Hakumi.textPrimary)
            .lineLimit(nil)
    }
}

struct CardDescription: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(.system(size: 14, weight: .regular))
            .foregroundStyle(Color.Hakumi.textTertiary)
            .lineLimit(nil)
    }
}

struct CardContent<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content()
        }
        .padding(.horizontal, Spacing.lg)
    }
}

struct CardFooter<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        HStack {
            content()
        }
        .padding(.horizontal, Spacing.lg)
    }
}

// MARK: - Surface

enum SurfaceElevation {
    case surface
    case elevated
    case overlay

    var backgroundColor: Color {
        switch self {
        case .surface:  Color.Hakumi.bgSurface
        case .elevated: Color.Hakumi.bgElevated
        case .overlay:  Color.Hakumi.bgOverlay
        }
    }
}

struct Surface<Content: View>: View {
    var elevation: SurfaceElevation = .surface
    var showBorder: Bool = true
    var showShadow: Bool = true
    var radius: CGFloat = Radii.icon
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(elevation.backgroundColor)
            )
            .overlay(
                showBorder
                ? RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
                : nil
            )
            .shadow(
                color: showShadow ? Shadows.low.color : .clear,
                radius: showShadow ? Shadows.low.radius : 0,
                x: showShadow ? Shadows.low.x : 0,
                y: showShadow ? Shadows.low.y : 0
            )
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
    }
}

// MARK: - Previews

#Preview("Card") {
    Card {
        CardHeader {
            CardTitle("Session title")
            CardDescription("A short description of what this card contains.")
        }
        CardContent {
            Text("Main content area goes here.")
                .font(.system(size: 15))
                .foregroundStyle(Color.Hakumi.textPrimary)
        }
        CardFooter {
            AppButton("Action", variant: .primary, size: .sm, action: {})
        }
    }
    .padding()
    .background(Color.Hakumi.bgBase)
}

#Preview("Surface elevations") {
    VStack(spacing: Spacing.md) {
        Surface(elevation: .surface) {
            Text("Surface").foregroundStyle(Color.Hakumi.textPrimary).padding()
        }
        Surface(elevation: .elevated) {
            Text("Elevated").foregroundStyle(Color.Hakumi.textPrimary).padding()
        }
        Surface(elevation: .overlay) {
            Text("Overlay").foregroundStyle(Color.Hakumi.textPrimary).padding()
        }
    }
    .padding()
    .background(Color.Hakumi.bgBase)
}
