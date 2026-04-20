import SwiftUI

// MARK: - AppTextField

struct AppTextField: View {
    var label: String? = nil
    var placeholder: String = ""
    @Binding var text: String
    var isDisabled: Bool = false
    var isSecure: Bool = false
    var error: String? = nil
    var helpText: String? = nil
    var isRequired: Bool = false
    var identifier: String? = nil

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let label {
                fieldLabel(label)
            }
            inputField
                .padding(.top, label != nil ? Spacing.sm : 0)
            if let error {
                Text(error)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.Hakumi.destructive)
                    .padding(.top, Spacing.xs)
            } else if let helpText {
                Text(helpText)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.Hakumi.textTertiary)
                    .padding(.top, Spacing.xs)
            }
        }
        .opacity(isDisabled ? 0.5 : 1)
    }

    @ViewBuilder
    private var inputField: some View {
        let borderColor: Color = error != nil
            ? Color.Hakumi.destructive
            : (isFocused ? Color.Hakumi.borderFocus : Color.Hakumi.borderDefault)

        Group {
            if isSecure {
                SecureField(placeholder, text: $text)
                    .accessibilityIdentifier(identifier ?? "")
            } else {
                TextField(placeholder, text: $text)
                    .accessibilityIdentifier(identifier ?? "")
            }
        }
        .font(.system(size: 17))
        .foregroundStyle(Color.Hakumi.textPrimary)
        .tint(Color.Hakumi.accent)
        .focused($isFocused)
        .disabled(isDisabled)
        .padding(.horizontal, Spacing.sm2)
        .padding(.vertical, Spacing.sm)
        .frame(minHeight: 44)
        .background(
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(Color.Hakumi.muted)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .strokeBorder(borderColor, lineWidth: 1)
        )
        .animation(Motion.standard, value: isFocused)
        .animation(Motion.standard, value: error != nil)
    }

    @ViewBuilder
    private func fieldLabel(_ text: String) -> some View {
        HStack(spacing: 2) {
            Text(text)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.Hakumi.textSecondary)
            if isRequired {
                Text("*")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.Hakumi.destructive)
            }
        }
    }
}

// MARK: - AppTextArea

struct AppTextArea: View {
    var label: String? = nil
    var placeholder: String = ""
    @Binding var text: String
    var isDisabled: Bool = false
    var error: String? = nil
    var helpText: String? = nil
    var minHeight: CGFloat = 120

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let label {
                fieldLabel(label)
                    .padding(.bottom, Spacing.sm)
            }
            textEditorField
            if let error {
                Text(error)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.Hakumi.destructive)
                    .padding(.top, Spacing.xs)
            } else if let helpText {
                Text(helpText)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.Hakumi.textTertiary)
                    .padding(.top, Spacing.xs)
            }
        }
        .opacity(isDisabled ? 0.5 : 1)
    }

    @ViewBuilder
    private var textEditorField: some View {
        let borderColor: Color = error != nil
            ? Color.Hakumi.destructive
            : (isFocused ? Color.Hakumi.borderFocus : Color.Hakumi.borderDefault)

        TextEditor(text: $text)
            .font(.system(size: 14, design: .monospaced))
            .foregroundStyle(Color.Hakumi.textPrimary)
            .tint(Color.Hakumi.accent)
            .focused($isFocused)
            .disabled(isDisabled)
            .scrollContentBackground(.hidden)
            .padding(.horizontal, Spacing.sm2)
            .padding(.vertical, Spacing.sm2)
            .frame(minHeight: minHeight, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Color.Hakumi.muted)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .strokeBorder(borderColor, lineWidth: 1)
            )
            .animation(Motion.standard, value: isFocused)
    }

    @ViewBuilder
    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Color.Hakumi.textSecondary)
    }
}

// MARK: - Previews

#Preview("TextField states") {
    VStack(spacing: Spacing.md) {
        AppTextField(label: "Email", placeholder: "you@example.com", text: .constant(""))
        AppTextField(label: "Required", placeholder: "Required field", text: .constant(""), isRequired: true)
        AppTextField(label: "With value", placeholder: "", text: .constant("hello@example.com"))
        AppTextField(label: "Error", placeholder: "", text: .constant("bad-input"), error: "Invalid email address")
        AppTextField(label: "Help text", placeholder: "", text: .constant(""), helpText: "We'll never share your email.")
        AppTextField(label: "Disabled", placeholder: "Disabled", text: .constant(""), isDisabled: true)
    }
    .padding()
    .background(Color.Hakumi.bgBase)
}

#Preview("TextArea") {
    AppTextArea(label: "Note", placeholder: "Write something...", text: .constant(""))
        .padding()
        .background(Color.Hakumi.bgBase)
}
