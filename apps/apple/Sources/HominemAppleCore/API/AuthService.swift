import Foundation

@MainActor
public final class AuthService {
    private let client: APIClient
    private let passkeyProvider: any PasskeyProviding

    public init(
        client: APIClient,
        passkeyProvider: any PasskeyProviding
    ) {
        self.client = client
        self.passkeyProvider = passkeyProvider
    }

    public func restoreSession() async throws -> AuthSession? {
        do {
            return try await client.get(AuthSession?.self, path: "/api/auth/session")
        } catch let error as APIClientError {
            if case .http(statusCode: 401, _) = error {
                return nil
            }
            throw error
        }
    }

    public func sendEmailOTP(email: String) async throws {
        struct Body: Encodable {
            let email: String
        }

        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        _ = try await client.post(
            SuccessEnvelope.self,
            path: "/api/auth/email-otp/send",
            body: Body(email: normalizedEmail)
        )
    }

    public func fetchLatestTestOTP(email: String, secret: String) async throws -> String {
        struct OTPEnvelope: Decodable {
            let otp: String
        }

        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedSecret = secret.trimmingCharacters(in: .whitespacesAndNewlines)

        let payload = try await client.get(
            OTPEnvelope.self,
            path: "/api/auth/test/otp/latest",
            query: [
                URLQueryItem(name: "email", value: normalizedEmail),
                URLQueryItem(name: "type", value: "sign-in"),
            ],
            headers: [
                "x-e2e-auth-secret": normalizedSecret,
            ]
        )

        return payload.otp
    }

    public func verifyEmailOTP(email: String, otp: String, name: String?) async throws -> AuthSession {
        struct Body: Encodable {
            let email: String
            let otp: String
            let name: String?
        }

        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedOTP = otp.filter(\.isNumber)

        _ = try await client.post(
            EmailOTPSignInEnvelope.self,
            path: "/api/auth/email-otp/verify",
            body: Body(email: normalizedEmail, otp: normalizedOTP, name: name)
        )

        guard let session = try await restoreSession() else {
            throw APIClientError.http(statusCode: 500, message: "Sign-in succeeded but the session was not restored.")
        }

        return session
    }

    public func signInWithPasskey() async throws -> AuthSession {
        struct OptionsBody: Encodable {}

        let options = try await client.post(
            PasskeyAuthenticationOptions.self,
            path: "/api/auth/passkey/auth/options",
            body: OptionsBody()
        )
        let response = try await passkeyProvider.authenticate(using: options)

        struct VerifyBody: Encodable {
            let response: PasskeyAuthenticationResponse
        }

        _ = try await client.post(
            PasskeyAuthenticationVerifyEnvelope.self,
            path: "/api/auth/passkey/auth/verify",
            body: VerifyBody(response: response)
        )

        guard let session = try await restoreSession() else {
            throw APIClientError.http(statusCode: 500, message: "Passkey sign-in succeeded but the session was not restored.")
        }

        return session
    }

    public func listPasskeys() async throws -> [RegisteredPasskey] {
        try await client.get([RegisteredPasskey].self, path: "/api/auth/passkeys")
    }

    public func registerPasskey(name: String?) async throws -> [RegisteredPasskey] {
        struct OptionsBody: Encodable {
            let name: String?
            let authenticatorAttachment: String
        }

        let trimmedName = name?.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedName = trimmedName?.isEmpty == false ? trimmedName : nil

        let options = try await client.post(
            PasskeyRegistrationOptions.self,
            path: "/api/auth/passkey/register/options",
            body: OptionsBody(name: normalizedName, authenticatorAttachment: "platform")
        )
        let response = try await passkeyProvider.register(using: options)

        struct VerifyBody: Encodable {
            let response: PasskeyRegistrationResponse
            let name: String?
        }

        _ = try await client.post(
            RegisteredPasskey.self,
            path: "/api/auth/passkey/register/verify",
            body: VerifyBody(response: response, name: normalizedName)
        )

        return try await listPasskeys()
    }

    public func deletePasskey(id: String) async throws -> [RegisteredPasskey] {
        do {
            return try await deletePasskey(id: id, allowStepUpRetry: true)
        } catch let error as APIClientError {
            throw error
        }
    }

    public func signOut() async throws {
        do {
            try await client.post(path: "/api/auth/logout")
        } catch let error as APIClientError {
            if case .http(statusCode: 401, _) = error {
                try await client.clearCookies()
                return
            }
            throw error
        }

        try await client.clearCookies()
    }

    private func deletePasskey(id: String, allowStepUpRetry: Bool) async throws -> [RegisteredPasskey] {
        struct Body: Encodable {
            let id: String
        }

        do {
            _ = try await client.delete(
                SuccessEnvelope.self,
                path: "/api/auth/passkey/delete",
                body: Body(id: id)
            )
            return try await listPasskeys()
        } catch let error as APIClientError {
            guard allowStepUpRetry, case .http(statusCode: 403, let message) = error else {
                throw error
            }

            if message.contains("step_up_required") == false {
                throw error
            }

            _ = try await signInWithPasskey()
            return try await deletePasskey(id: id, allowStepUpRetry: false)
        }
    }
}

private struct PasskeyAuthenticationVerifyEnvelope: Codable, Equatable, Sendable {
    let session: AuthSessionDetails?
}
