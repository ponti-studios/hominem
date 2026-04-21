import SwiftUI

// MARK: - LabeledDivider

/// A horizontal rule with a short text label centred between two lines.
/// Usage: `LabeledDivider(label: "or")`
struct LabeledDivider: View {
    let label: String

    var body: some View {
        HStack(spacing: Spacing.sm) {
            line
            Text(label)
                .textStyle(AppTypography.caption1)
                .foregroundStyle(Color.Hakumi.textTertiary)
                .fixedSize()
            line
        }
    }

    private var line: some View {
        Rectangle()
            .fill(Color.Hakumi.borderDefault)
            .frame(height: 1)
    }
}

#Preview {
    LabeledDivider(label: "or")
        .padding()
}
