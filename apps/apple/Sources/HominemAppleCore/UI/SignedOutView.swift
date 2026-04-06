import SwiftUI

struct SignedOutView: View {
    @Bindable var model: AppModel

    var body: some View {
        ScrollView {
            VStack(spacing: AppleTheme.lg) {
                VStack(spacing: AppleTheme.sm) {
                    HStack(spacing: AppleTheme.sm) {
                        Text("HOMINEM")
                            .font(AppleTheme.heroEyebrowFont)
                            .foregroundStyle(AppleTheme.tertiaryText)
                            .tracking(2)

                        Circle()
                            .fill(AppleTheme.accent)
                            .frame(width: 10, height: 10)
                    }

                    Text("Sign in")
                        .font(AppleTheme.heroTitleFont)
                        .foregroundStyle(AppleTheme.foreground)

                    Text("Enter your email to receive a one-time code.")
                        .font(AppleTheme.bodyFont)
                        .foregroundStyle(AppleTheme.tertiaryText)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 280)
                }
                .frame(maxWidth: .infinity)

                VStack(alignment: .leading, spacing: AppleTheme.md) {
                    AppTextInput(
                        label: "Email",
                        placeholder: "Email",
                        text: $model.emailInput,
                        accessibilityIdentifier: "auth.emailField",
                        disableAutocorrection: true
                    )

                    AppTextInput(
                        label: "Display name",
                        placeholder: "Display name",
                        text: $model.nameInput,
                        accessibilityIdentifier: "auth.nameField"
                    )

                    if let errorMessage = model.state.errorMessage {
                        Text(errorMessage)
                            .font(AppleTheme.captionFont)
                            .foregroundStyle(AppleTheme.destructive)
                            .accessibilityIdentifier("auth.errorText")
                    }

                    Button("Send code") {
                        Task {
                            await model.requestEmailOTP()
                        }
                    }
                    .buttonStyle(AppButtonStyle(.standard, fullWidth: true))
                    .disabled(model.emailInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityIdentifier("auth.sendCodeButton")

                    if model.state.pendingEmail.isEmpty == false {
                        AppTextInput(
                            label: "One-time code",
                            placeholder: "One-time code",
                            text: $model.otpInput,
                            accessibilityIdentifier: "auth.otpField",
                            disableAutocorrection: true
                        )

                        if model.canFetchLocalTestOTP {
                            Button("Fetch local test code") {
                                Task {
                                    await model.fetchLatestTestOTP()
                                }
                            }
                            .buttonStyle(AppButtonStyle(.standard, fullWidth: true))
                            .accessibilityIdentifier("auth.fetchLocalTestCodeButton")
                        }

                        Button("Verify code") {
                            Task {
                                await model.verifyEmailOTP()
                            }
                        }
                        .buttonStyle(AppButtonStyle(.standard, fullWidth: true))
                        .disabled(model.otpInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .accessibilityIdentifier("auth.verifyCodeButton")
                    }

                    Button("Use passkey") {
                        Task {
                            await model.signInWithPasskey()
                        }
                    }
                    .buttonStyle(AppButtonStyle(.link))
                    .accessibilityIdentifier("auth.passkeyButton")

                    if model.state.errorMessage != nil {
                        Button("Dismiss") {
                            model.clearError()
                        }
                        .buttonStyle(AppButtonStyle(.link))
                        .accessibilityIdentifier("auth.dismissErrorButton")
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .frame(maxWidth: AppleTheme.authWidth)
            .padding(.horizontal, AppleTheme.md)
            .padding(.vertical, AppleTheme.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(AppleTheme.background.ignoresSafeArea())
    }
}
