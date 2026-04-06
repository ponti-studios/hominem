import SwiftUI

enum AppleTheme {
    static let background = Color.white
    static let surface = Color(red: 245 / 255, green: 245 / 255, blue: 247 / 255)
    static let foreground = Color.black
    static let secondaryText = Color(red: 85 / 255, green: 85 / 255, blue: 85 / 255)
    static let tertiaryText = Color(red: 136 / 255, green: 136 / 255, blue: 136 / 255)
    static let border = Color.black.opacity(0.1)
    static let muted = Color.black.opacity(0.05)
    static let secondaryFill = Color.black.opacity(0.1)
    static let destructive = Color(red: 1, green: 59 / 255, blue: 48 / 255)
    static let accent = Color(red: 0, green: 122 / 255, blue: 1)

    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let sm12: CGFloat = 12
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32

    static let cardRadius: CGFloat = 8
    static let controlRadius: CGFloat = 10
    static let authWidth: CGFloat = 420
    static let contentWidth: CGFloat = 560

    static let heroEyebrowFont = Font.system(size: 12, weight: .medium)
    static let heroTitleFont = Font.system(size: 36, weight: .bold)
    static let sectionTitleFont = Font.system(size: 24, weight: .semibold)
    static let bodyFont = Font.system(size: 17, weight: .regular)
    static let bodyStrongFont = Font.system(size: 18, weight: .semibold)
    static let labelFont = Font.system(size: 14, weight: .medium)
    static let captionFont = Font.system(size: 12, weight: .medium)
    static let buttonFont = Font.system(size: 14, weight: .semibold)
    static let monoFont = Font.system(size: 14, weight: .regular, design: .monospaced)
    static let monoCaptionFont = Font.system(size: 12, weight: .regular, design: .monospaced)
}
