import SwiftUI

// Source: packages/platform/ui/src/tokens/shadows.ts
// shadowColor: #0f1113

struct AppShadow {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat
}

enum Shadows {
    static let low    = AppShadow(color: Color(hex: "#0F1113").opacity(0.35), radius: 8,  x: 0, y: 2)
    static let medium = AppShadow(color: Color(hex: "#0F1113").opacity(0.45), radius: 24, x: 0, y: 8)
    static let high   = AppShadow(color: Color(hex: "#0F1113").opacity(0.55), radius: 60, x: 0, y: 20)
}

extension View {
    func shadowLow()    -> some View { shadow(color: Shadows.low.color,    radius: Shadows.low.radius,    x: Shadows.low.x,    y: Shadows.low.y) }
    func shadowMedium() -> some View { shadow(color: Shadows.medium.color, radius: Shadows.medium.radius, x: Shadows.medium.x, y: Shadows.medium.y) }
    func shadowHigh()   -> some View { shadow(color: Shadows.high.color,   radius: Shadows.high.radius,   x: Shadows.high.x,   y: Shadows.high.y) }
}
