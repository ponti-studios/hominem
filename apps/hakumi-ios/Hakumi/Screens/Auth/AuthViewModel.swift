import Foundation

// MARK: - AuthValidationError

enum AuthValidationError: LocalizedError {
    case emailRequired
    case emailInvalid

    var errorDescription: String? {
        switch self {
        case .emailRequired: return AuthCopy.emailEntry.emailRequiredError
        case .emailInvalid:  return AuthCopy.emailEntry.emailInvalidError
        }
    }
}

// MARK: - AuthViewModel

@Observable
@MainActor
final class AuthViewModel {

    // MARK: Send OTP

    /// Validates `email`, sends an OTP, and returns the normalized email for routing.
    func sendCode(email: String) async throws -> String {
        let normalized = AuthService.normalizeEmail(email)
        guard !normalized.isEmpty else { throw AuthValidationError.emailRequired }
        guard AuthService.isValidEmail(normalized) else { throw AuthValidationError.emailInvalid }
        try await AuthService.sendOTP(email: normalized)
        return normalized
    }

    // MARK: Passkey sign-in

    func signInWithPasskey() async throws {
        let user = try await PasskeyService.signIn()
        AuthProvider.shared.completeSignIn(user: user)
    }

    // MARK: OTP verification

    func verifyOTP(email: String, otp: String) async throws {
        let user = try await AuthService.verifyOTP(email: email, otp: otp)
        AuthProvider.shared.completeSignIn(user: user)
    }

    // MARK: Resend OTP

    func resendOTP(email: String) async throws {
        try await AuthService.resendOTP(email: email)
    }

    // MARK: Onboarding

    func createProfile(name: String) async throws {
        try await AuthProvider.shared.updateName(name)
    }
}
