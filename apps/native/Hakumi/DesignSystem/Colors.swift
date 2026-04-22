import SwiftUI

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b, a: UInt64
        switch hex.count {
        case 6:
            (r, g, b, a) = (int >> 16, int >> 8 & 0xFF, int & 0xFF, 255)
        case 8:
            (r, g, b, a) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (r, g, b, a) = (0, 0, 0, 255)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Hakumi color tokens
// Source: packages/platform/ui/src/tokens/colors.ts

extension Color {
    enum Hakumi {

        // MARK: Background
        static let bgBase        = Color(hex: "#111113")
        static let bgSurface     = Color(hex: "#18191B")
        static let bgElevated    = Color(hex: "#212225")
        static let bgOverlay     = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.06)

        // MARK: Text
        static let textPrimary   = Color(hex: "#F5F6F8")
        static let textSecondary = Color(hex: "#B4B9C3")
        static let textTertiary  = Color(hex: "#8D93A1")
        static let textDisabled  = Color(hex: "#616775")

        // MARK: Border
        static let borderDefault = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.18)
        static let borderFaint   = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.07)
        static let borderSubtle  = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.11)
        static let borderFocus   = Color(.sRGB, red: 142/255, green: 141/255, blue: 255/255, opacity: 0.50)

        // MARK: Icon
        static let iconPrimary   = Color(hex: "#F5F6F8")
        static let iconMuted     = Color(hex: "#8D93A1")

        // MARK: Accent
        static let accent            = Color(hex: "#8E8DFF")
        static let accentForeground  = Color(hex: "#0F1028")

        // MARK: Semantic status
        static let success           = Color(hex: "#3DD68C")
        static let warning           = Color(hex: "#FFD166")
        static let destructive       = Color(hex: "#FF7B5C")
        static let destructiveMuted  = Color(.sRGB, red: 255/255, green: 123/255, blue: 92/255, opacity: 0.65)
        static let destructiveForeground = Color(hex: "#1D0E0A")

        // MARK: Emphasis scale
        static let emphasisHighest = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.92)
        static let emphasisHigh    = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.76)
        static let emphasisMedium  = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.56)
        static let emphasisLow     = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.38)
        static let emphasisLower   = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.26)
        static let emphasisSubtle  = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.18)
        static let emphasisMinimal = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.12)
        static let emphasisFaint   = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.07)

        // MARK: Semantic aliases (backward-compat mapping)
        static let foreground           = Color(hex: "#F5F6F8")
        static let background           = Color(hex: "#111113")
        static let secondary            = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.14)
        static let secondaryForeground  = Color(hex: "#E5E8EF")
        static let muted                = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.08)
        static let mutedForeground      = Color(hex: "#B4B9C3")
        static let popover              = Color(hex: "#18191B")
        static let popoverForeground    = Color(hex: "#F5F6F8")
        static let input                = Color(hex: "#18191B")

        // MARK: Modal overlays
        static let overlayModalHigh   = Color(.sRGB, red: 17/255, green: 19/255, blue: 24/255, opacity: 0.62)
        static let overlayModalMedium = Color(.sRGB, red: 17/255, green: 19/255, blue: 24/255, opacity: 0.46)

        // MARK: Charts
        static let chart1 = Color(hex: "#8E8DFF")
        static let chart2 = Color(hex: "#3DD68C")
        static let chart3 = Color(hex: "#38BDF8")
        static let chart4 = Color(hex: "#FFD166")
        static let chart5 = Color(hex: "#FF7B5C")

        // MARK: Sidebar
        static let sidebar                = Color(hex: "#0F1012")
        static let sidebarForeground      = Color(hex: "#F5F6F8")
        static let sidebarPrimary         = Color(hex: "#8E8DFF")
        static let sidebarPrimaryForeground = Color(hex: "#0F1028")
        static let sidebarAccent          = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.08)
        static let sidebarAccentForeground = Color(hex: "#F5F6F8")
        static let sidebarBorder          = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.14)

        // MARK: Prompt input
        static let promptBg          = Color(hex: "#18191B")
        static let promptBorder      = Color(.sRGB, red: 245/255, green: 246/255, blue: 248/255, opacity: 0.18)
        static let promptBorderFocus = Color(.sRGB, red: 142/255, green: 141/255, blue: 255/255, opacity: 0.50)

        // MARK: Vendor
        static let googleMapsBlue = Color(hex: "#4285F4")

        // MARK: Primitives
        static let black = Color(hex: "#000000")
        static let white = Color(hex: "#FFFFFF")
    }
}
