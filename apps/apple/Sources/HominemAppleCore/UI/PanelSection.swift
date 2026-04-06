import SwiftUI

struct PanelSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: AppleTheme.sm) {
            Text(title)
                .font(AppleTheme.sectionTitleFont)
                .foregroundStyle(AppleTheme.foreground)

            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(AppleTheme.md)
        .background(AppleTheme.background)
        .overlay(
            RoundedRectangle(cornerRadius: AppleTheme.cardRadius, style: .continuous)
                .stroke(AppleTheme.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: AppleTheme.cardRadius, style: .continuous))
    }
}
