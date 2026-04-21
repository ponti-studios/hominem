import SwiftUI

// MARK: - Card style helper
//
// Replaces inline RoundedRectangle + fill + strokeBorder patterns
// with a single modifier call.

extension View {
    func cardStyle(radius: CGFloat = Radii.sm, fill: Color = Color.Hakumi.bgSurface) -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(fill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
            )
    }
}
