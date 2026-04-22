import Foundation

// MARK: - Auth Models

struct AuthUser: Codable, Sendable {
    let id: String
    let email: String
    let name: String?
}

// MARK: - AuthError

enum AuthError: LocalizedError, Sendable {
    case networkError
    case serverError(String)
    case invalidResponse
    case timeout

    var errorDescription: String? {
        switch self {
        case .networkError:
            return "Unable to connect. Check your internet connection."
        case .serverError(let message):
            return message
        case .invalidResponse:
            return "Unexpected response from server."
        case .timeout:
            return "Request timed out. Please try again."
        }
    }
}

// MARK: - AuthService

enum AuthService {
    static let sendOTPPath = "/api/auth/email-otp/send-verification-otp"
    static let verifyOTPPath = "/api/auth/sign-in/email-otp"

    static var apiBaseURL: URL {
        let fromBundle = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String ?? ""
        let rawURL = fromBundle.isEmpty ? "http://localhost:4040" : fromBundle
        return URL(string: fromURL(rawURL))!
    }

    static func apiURL(_ path: String) -> URL {
        URL(string: apiBaseURL.absoluteString + path)!
    }

    private static func fromURL(_ raw: String) -> String {
        raw.hasSuffix("/") ? String(raw.dropLast()) : raw
    }

    // MARK: - Send OTP

    /// POST /api/auth/email-otp/send-verification-otp
    static func sendOTP(email: String) async throws {
        let url = apiURL(sendOTPPath)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["email": email, "type": "sign-in"])
        request.timeoutInterval = 12

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw AuthError.networkError
        }
        guard (200..<300).contains(http.statusCode) else {
            let msg = extractMessage(from: data) ?? "Unable to send verification code."
            throw AuthError.serverError(msg)
        }
    }

    // MARK: - Verify OTP

    /// POST /api/auth/sign-in/email-otp
    static func verifyOTP(email: String, otp: String) async throws -> AuthUser {
        let url = apiURL(verifyOTPPath)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["email": email, "otp": otp])
        request.timeoutInterval = 20

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw AuthError.networkError
        }
        guard (200..<300).contains(http.statusCode) else {
            let msg = extractMessage(from: data)
                ?? AuthCopy.otpVerification.verifyFailedError
            throw AuthError.serverError(msg)
        }

        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let userData = json["user"] as? [String: Any],
            let id = userData["id"] as? String,
            let userEmail = userData["email"] as? String
        else {
            throw AuthError.invalidResponse
        }

        return AuthUser(id: id, email: userEmail, name: userData["name"] as? String)
    }

    // MARK: - Resend OTP

    /// Re-sends a sign-in OTP by calling sendOTP again.
    static func resendOTP(email: String) async throws {
        try await sendOTP(email: email)
    }

    // MARK: - Private helpers

    static func extractMessage(from data: Data) -> String? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return json["message"] as? String ?? json["error"] as? String
    }
}

// MARK: - Input validation helpers

extension AuthService {
    static func normalizeEmail(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespaces).lowercased()
    }

    static func isValidEmail(_ value: String) -> Bool {
        let normalized = normalizeEmail(value)
        let pattern = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
        return normalized.range(of: pattern, options: .regularExpression) != nil
    }

    static func normalizeOTP(_ value: String) -> String {
        let digits = value.filter(\.isNumber)
        return String(digits.prefix(6))
    }

    static func isValidOTP(_ value: String) -> Bool {
        let normalized = normalizeOTP(value)
        return normalized.count == 6 && normalized.allSatisfy(\.isNumber)
    }
}
