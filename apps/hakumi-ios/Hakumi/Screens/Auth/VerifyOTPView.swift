import SwiftUI

// MARK: - VerifyOTPScreen

struct VerifyOTPScreen: View {
    let email: String

    @Environment(Router.self) private var router

    @State private var otp = ""
    @State private var isVerifying = false
    @State private var isResending = false
    @State private var error: String? = nil
    @State private var resendSuccess = false

    private var normalizedOTP: String { AuthService.normalizeOTP(otp) }
    private var isBusy: Bool { isVerifying || isResending }
    private var canVerify: Bool { normalizedOTP.count == 6 && !isBusy }

    var body: some View {
        AuthLayout(
            title: AuthCopy.otpVerification.title,
            helper: AuthCopy.otpVerification.helper(email: email)
        ) {
            VStack(spacing: Spacing.md) {
                AppTextField(
                    label: AuthCopy.otpVerification.codeLabel,
                    placeholder: AuthCopy.otpVerification.codePlaceholder,
                    text: Binding(
                        get: { normalizedOTP },
                        set: { otp = $0; error = nil; resendSuccess = false }
                    ),
                    isDisabled: isBusy,
                    error: error,
                    identifier: "auth.otpField"
                )
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .autocorrectionDisabled()

                if resendSuccess {
                    Text("Code resent.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.Hakumi.success)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                AppButton(AuthCopy.otpVerification.verifyButton, variant: .primary, isLoading: isVerifying) {
                    Task { await handleVerify() }
                }
                .disabled(!canVerify)
                .frame(maxWidth: .infinity)
                .accessibilityIdentifier("auth.verifyButton")

                HStack {
                    Button(AuthCopy.otpVerification.resendButton) {
                        Task { await handleResend() }
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.Hakumi.textTertiary)
                    .underline()
                    .disabled(isBusy)

                    Spacer()

                    Button(AuthCopy.otpVerification.changeEmailLink) {
                        router.authPath.removeLast()
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.Hakumi.textTertiary)
                    .underline()
                    .disabled(isBusy)
                }
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            #if E2E
            if let testOTP = ProcessInfo.processInfo.environment["E2E_OTP"] {
                otp = testOTP
                Task { await handleVerify() }
            }
            #endif
        }
    }

    // MARK: - Actions

    private func handleVerify() async {
        guard canVerify else { return }
        isVerifying = true
        error = nil
        defer { isVerifying = false }

        do {
            let user = try await AuthService.verifyOTP(email: email, otp: normalizedOTP)
            AuthProvider.shared.completeSignIn(user: user)
            router.completeAuthentication()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func handleResend() async {
        isResending = true
        error = nil
        resendSuccess = false
        defer { isResending = false }

        do {
            try await AuthService.resendOTP(email: email)
            resendSuccess = true
            otp = ""
        } catch {
            self.error = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack {
        VerifyOTPScreen(email: "user@example.com")
            .environment(Router())
    }
}
