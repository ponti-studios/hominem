import SwiftUI

// Source: apps/mobile/components/theme/theme.ts (mobile text variants)
// Font family: system SF Pro (matches Expo iOS target)
// Line spacing in SwiftUI is applied via .lineSpacing() on Text views.
// Letter spacing maps to .tracking() — values converted from px to points (1:1 on 1x).

struct TextStyle {
    let font: Font
    let lineSpacing: CGFloat  // extra space between lines beyond leading
    let tracking: CGFloat     // letter spacing in points
}

enum AppTypography {

    // MARK: Text variants
    // Source values: size (pt), weight, letterSpacing (px), lineHeight (px)

    static let largeTitle = TextStyle(
        font: .system(size: 34, weight: .bold),
        lineSpacing: lineSpacingFor(lineHeight: 41, size: 34),
        tracking: -0.6
    )
    static let title1 = TextStyle(
        font: .system(size: 28, weight: .bold),
        lineSpacing: lineSpacingFor(lineHeight: 34, size: 28),
        tracking: -0.4
    )
    static let title2 = TextStyle(
        font: .system(size: 22, weight: .semibold),
        lineSpacing: lineSpacingFor(lineHeight: 28, size: 22),
        tracking: -0.2
    )
    static let headline = TextStyle(
        font: .system(size: 17, weight: .semibold),
        lineSpacing: lineSpacingFor(lineHeight: 22, size: 17),
        tracking: -0.1
    )
    static let body = TextStyle(
        font: .system(size: 17, weight: .regular),
        lineSpacing: lineSpacingFor(lineHeight: 24, size: 17),
        tracking: 0
    )
    static let callout = TextStyle(
        font: .system(size: 16, weight: .regular),
        lineSpacing: lineSpacingFor(lineHeight: 22, size: 16),
        tracking: -0.1
    )
    static let subhead = TextStyle(
        font: .system(size: 15, weight: .regular),
        lineSpacing: lineSpacingFor(lineHeight: 20, size: 15),
        tracking: 0
    )
    static let footnote = TextStyle(
        font: .system(size: 13, weight: .regular),
        lineSpacing: lineSpacingFor(lineHeight: 18, size: 13),
        tracking: 0
    )
    static let caption1 = TextStyle(
        font: .system(size: 12, weight: .regular),
        lineSpacing: lineSpacingFor(lineHeight: 16, size: 12),
        tracking: 0
    )
    static let caption2 = TextStyle(
        font: .system(size: 11, weight: .medium),
        lineSpacing: lineSpacingFor(lineHeight: 14, size: 11),
        tracking: 0.2
    )
    static let mono = TextStyle(
        font: .system(size: 12, weight: .regular, design: .monospaced),
        lineSpacing: lineSpacingFor(lineHeight: 16, size: 12),
        tracking: 0
    )

    // MARK: Line spacing helper
    // SwiftUI's .lineSpacing() adds *extra* space between lines on top of the natural leading.
    // Natural leading ≈ font size × 1.2. We compute the delta to hit the target lineHeight.
    private static func lineSpacingFor(lineHeight: CGFloat, size: CGFloat) -> CGFloat {
        max(0, lineHeight - size * 1.2)
    }
}

// MARK: - View modifier for applying a full TextStyle

struct TextStyleModifier: ViewModifier {
    let style: TextStyle

    func body(content: Content) -> some View {
        content
            .font(style.font)
            .lineSpacing(style.lineSpacing)
            .tracking(style.tracking)
    }
}

extension View {
    func textStyle(_ style: TextStyle) -> some View {
        modifier(TextStyleModifier(style: style))
    }
}
