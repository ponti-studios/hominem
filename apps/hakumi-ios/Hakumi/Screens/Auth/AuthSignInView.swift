import SwiftUI

// MARK: - AuthSignInScreen

struct AuthSignInScreen: View {
    @Environment(Router.self) private var router

    @State private var vm = AuthViewModel()
    @State private var email = ""
    @State private var isSubmitting = false
    @State private var isAuthenticatingPasskey = false
    @State private var error: String? = nil

    private var isBusy: Bool { isSubmitting || isAuthenticatingPasskey }

    var body: some View {
        AuthLayout(title: AuthCopy.emailEntry.title, helper: AuthCopy.emailEntry.helper) {
            VStack(spacing: Spacing.md) {
                AppTextField(
                    label: AuthCopy.emailEntry.emailLabel,
                    placeholder: AuthCopy.emailEntry.emailPlaceholder,
                    text: Binding(
                        get: { email },
                        set: { email = $0; error = nil }
                    ),
                    isDisabled: isBusy,
                    error: error,
                    identifier: "auth.emailField"
                )
                .keyboardType(.emailAddress)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)

                AppButton(AuthCopy.emailEntry.submitButton, variant: .primary, isLoading: isSubmitting) {
                    Task { await handleSendCode() }
                }
                .disabled(isBusy)
                .frame(maxWidth: .infinity)
                .accessibilityIdentifier("auth.continueButton")

                LabeledDivider(label: "or")

                AppButton(
                    AuthCopy.emailEntry.passkeyButton,
                    variant: .secondary,
                    isLoading: isAuthenticatingPasskey
                ) {
                    Task { await handlePasskeySignIn() }
                }
                .disabled(isBusy)
                .frame(maxWidth: .infinity)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Actions

    private func handleSendCode() async {
        isSubmitting = true
        error = nil
        defer { isSubmitting = false }
        do {
            let normalized = try await vm.sendCode(email: email)
            router.authPath.append(.verifyOTP(email: normalized))
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func handlePasskeySignIn() async {
        guard !isBusy else { return }
        isAuthenticatingPasskey = true
        error = nil
        defer { isAuthenticatingPasskey = false }
        do {
            try await vm.signInWithPasskey()
            router.completeAuthentication()
        } catch let serviceError as PasskeyServiceError {
            if serviceError == .cancelled { return }
            self.error = serviceError.localizedDescription
        } catch {
            self.error = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack {
        AuthSignInScreen()
            .environment(Router())
    }
}
