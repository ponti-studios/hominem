// Canonical auth UX copy — must stay in sync with
// packages/platform/auth/src/shared/ux-contract.ts

enum AuthCopy {
    enum emailEntry {
        static let title = "Sign in"
        static let helper = "We\u{2019}ll send a code to your email."
        static let emailPlaceholder = "you@example.com"
        static let emailLabel = "Email address"
        static let submitButton = "Continue"
        static let passkeyButton = "Use passkey"
        static let passkeyLoadingButton = "Connecting\u{2026}"
        static let emailRequiredError = "Email is required."
        static let emailInvalidError = "Enter a valid email address."
        static let sendFailedError = "Unable to send verification code."
    }

    enum otpVerification {
        static let title = "Verify"
        static func helper(email: String) -> String { "Code sent to \(email)." }
        static let codeLabel = "Verification code"
        static let codePlaceholder = "123456"
        static let verifyButton = "Verify"
        static let resendButton = "Resend code"
        static let changeEmailLink = "Use a different email"
        static let codeRequiredError = "Code is required."
        static let codeLengthError = "Code must be 6 digits."
        static let verifyFailedError = "There was a problem signing in. Our team is working on it."
        static let resendFailedError = "Unable to resend verification code."
    }

    enum passkey {
        static let genericError = "Passkey sign-in failed."
    }
}
