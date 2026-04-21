import SwiftUI

// MARK: - VerifyOTPScreen

struct VerifyOTPScreen: View {
    let email: String

    @Environment(Router.self) private var router

    @State private var vm = AuthViewModel()
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
            e2eAutoSubmitIfNeeded()
            #endif
        }
    }

    // MARK: - E2E helpers (Debug E2E builds only)

    #if E2E
    private func e2eAutoSubmitIfNeeded() {
        let env = ProcessInfo.processInfo.environment
        if let direct = env["E2E_OTP"], !direct.isEmpty {
            otp = direct
            Task { await handleVerify() }
        } else if let secret = env["E2E_SECRET"], !secret.isEmpty {
            Task { await fetchAndAutoSubmit(secret: secret) }
        }
    }

    private func fetchAndAutoSubmit(secret: String) async {
        try? await Task.sleep(for: .milliseconds(400))
        let encoded = email.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? email
        let url = AuthService.apiURL("/api/auth/test/otp/latest?email=\(encoded)&type=sign-in")
        var request = URLRequest(url: url)
        request.setValue(secret, forHTTPHeaderField: "x-e2e-auth-secret")
        request.timeoutInterval = 5

        for _ in 0..<5 {
            if let (data, response) = try? await URLSession.shared.data(for: request),
               let http = response as? HTTPURLResponse,
               http.statusCode == 200,
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let fetched = json["otp"] as? String,
               !fetched.isEmpty {
                otp = fetched
                await handleVerify()
                return
            }
            try? await Task.sleep(for: .milliseconds(500))
        }
    }
    #endif

    // MARK: - Actions

    private func handleVerify() async {
        guard canVerify else { return }
        isVerifying = true
        error = nil
        defer { isVerifying = false }
        do {
            try await vm.verifyOTP(email: email, otp: normalizedOTP)
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
            try await vm.resendOTP(email: email)
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
