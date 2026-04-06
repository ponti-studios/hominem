import SwiftUI

struct AppTextInput: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    let accessibilityIdentifier: String
    var disableAutocorrection: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: AppleTheme.xs) {
            Text(label.uppercased())
                .font(AppleTheme.labelFont)
                .foregroundStyle(AppleTheme.tertiaryText)

            TextField(placeholder, text: $text)
                .font(AppleTheme.monoFont)
                .foregroundStyle(AppleTheme.foreground)
                .autocorrectionDisabled(disableAutocorrection)
                .padding(.horizontal, AppleTheme.sm12)
                .padding(.vertical, AppleTheme.sm)
                .frame(minHeight: 44)
                .background(
                    RoundedRectangle(cornerRadius: AppleTheme.controlRadius, style: .continuous)
                        .fill(AppleTheme.muted)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: AppleTheme.controlRadius, style: .continuous)
                        .stroke(AppleTheme.border, lineWidth: 1)
                )
                .accessibilityIdentifier(accessibilityIdentifier)
        }
    }
}
