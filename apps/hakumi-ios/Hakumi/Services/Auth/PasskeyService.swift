import AuthenticationServices
import Foundation
import UIKit

// MARK: - Passkey errors

enum PasskeyServiceError: LocalizedError, Sendable, Equatable {
    case unsupportedDevice
    case cancelled
    case missingPresentationAnchor
    case invalidOptions
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .unsupportedDevice:
            return "Passkeys are not supported on this device."
        case .cancelled:
            return "Passkey sign-in was cancelled."
        case .missingPresentationAnchor:
            return "Unable to present the passkey prompt."
        case .invalidOptions:
            return "Unexpected passkey options from server."
        case .invalidResponse:
            return "Unexpected passkey response from server."
        }
    }
}

// MARK: - API models

struct PasskeyAuthenticationOptions: Decodable, Sendable {
    struct AllowedCredential: Decodable, Sendable {
        let id: String
        let type: String?
        let transports: [String]?
    }

    let challenge: String
    let rpId: String
    let allowCredentials: [AllowedCredential]?
    let userVerification: String?
}

struct PasskeyAuthenticationResponse: Encodable, Sendable {
    struct CredentialResponse: Encodable, Sendable {
        let authenticatorData: String
        let clientDataJSON: String
        let signature: String
    }

    let id: String
    let rawId: String
    let type: String
    let response: CredentialResponse

    init(
        credentialID: Data,
        clientDataJSON: Data,
        authenticatorData: Data,
        signature: Data
    ) {
        let encodedCredentialID = credentialID.base64URLEncodedString()
        id = encodedCredentialID
        rawId = encodedCredentialID
        type = "public-key"
        response = CredentialResponse(
            authenticatorData: authenticatorData.base64URLEncodedString(),
            clientDataJSON: clientDataJSON.base64URLEncodedString(),
            signature: signature.base64URLEncodedString()
        )
    }

    init(assertion: ASAuthorizationPlatformPublicKeyCredentialAssertion) {
        self.init(
            credentialID: assertion.credentialID,
            clientDataJSON: assertion.rawClientDataJSON,
            authenticatorData: assertion.rawAuthenticatorData,
            signature: assertion.signature
        )
    }
}

private struct PasskeyVerificationResponse: Decodable {
    let user: AuthUser
}

// MARK: - Passkey service

@MainActor
enum PasskeyService {
    private static var activeAuthorizationSession: PasskeyAuthorizationSession?

    static func signIn() async throws -> AuthUser {
        let options = try await fetchAuthenticationOptions()
        let assertion = try await authenticate(with: options)
        let response = PasskeyAuthenticationResponse(assertion: assertion)
        return try await verifyAuthentication(response)
    }

    private static func fetchAuthenticationOptions() async throws -> PasskeyAuthenticationOptions {
        let request = URLRequest(url: AuthService.apiURL("/api/auth/passkey/generate-authenticate-options"))

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw AuthError.networkError
        }

        guard (200..<300).contains(http.statusCode) else {
            let message = AuthService.extractMessage(from: data) ?? "Unable to start passkey sign-in."
            throw AuthError.serverError(message)
        }

        do {
            return try JSONDecoder().decode(PasskeyAuthenticationOptions.self, from: data)
        } catch {
            throw PasskeyServiceError.invalidOptions
        }
    }

    private static func authenticate(
        with options: PasskeyAuthenticationOptions
    ) async throws -> ASAuthorizationPlatformPublicKeyCredentialAssertion {
        guard let presentationAnchor = currentPresentationAnchor() else {
            throw PasskeyServiceError.missingPresentationAnchor
        }

        guard let challenge = Data(base64URLEncoded: options.challenge) else {
            throw PasskeyServiceError.invalidOptions
        }

        return try await withCheckedThrowingContinuation { continuation in
            let session = PasskeyAuthorizationSession(
                presentationAnchor: presentationAnchor,
                challenge: challenge,
                options: options,
                continuation: continuation,
                onFinish: {
                    activeAuthorizationSession = nil
                }
            )
            activeAuthorizationSession = session
            session.start()
        }
    }

    private static func verifyAuthentication(_ response: PasskeyAuthenticationResponse) async throws -> AuthUser {
        let request = URLRequest(url: AuthService.apiURL("/api/auth/passkey/verify-authentication"))
        var mutableRequest = request
        mutableRequest.httpMethod = "POST"
        mutableRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        mutableRequest.httpBody = try JSONEncoder().encode(["response": response])
        mutableRequest.timeoutInterval = 20

        let (data, response) = try await URLSession.shared.data(for: mutableRequest)

        guard let http = response as? HTTPURLResponse else {
            throw AuthError.networkError
        }

        guard (200..<300).contains(http.statusCode) else {
            let message = AuthService.extractMessage(from: data) ?? AuthCopy.passkey.genericError
            throw AuthError.serverError(message)
        }

        do {
            return try JSONDecoder().decode(PasskeyVerificationResponse.self, from: data).user
        } catch {
            throw PasskeyServiceError.invalidResponse
        }
    }

    private static func currentPresentationAnchor() -> UIWindow? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first(where: { $0.isKeyWindow })
    }
}

// MARK: - Authorization session

@MainActor
private final class PasskeyAuthorizationSession: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private let presentationAnchor: UIWindow
    private let challenge: Data
    private let options: PasskeyAuthenticationOptions
    private let continuation: CheckedContinuation<ASAuthorizationPlatformPublicKeyCredentialAssertion, Error>
    private let onFinish: () -> Void
    private var controller: ASAuthorizationController?
    private var didComplete = false

    init(
        presentationAnchor: UIWindow,
        challenge: Data,
        options: PasskeyAuthenticationOptions,
        continuation: CheckedContinuation<ASAuthorizationPlatformPublicKeyCredentialAssertion, Error>,
        onFinish: @escaping () -> Void
    ) {
        self.presentationAnchor = presentationAnchor
        self.challenge = challenge
        self.options = options
        self.continuation = continuation
        self.onFinish = onFinish
    }

    func start() {
        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: options.rpId)
        let request = provider.createCredentialAssertionRequest(challenge: challenge)

        if let allowCredentials = options.allowCredentials, !allowCredentials.isEmpty {
            request.allowedCredentials = allowCredentials.compactMap { credential in
                guard let credentialID = Data(base64URLEncoded: credential.id) else {
                    return nil
                }
                return ASAuthorizationPlatformPublicKeyCredentialDescriptor(credentialID: credentialID)
            }
        }

        if let userVerification = options.userVerification {
            switch userVerification {
            case "required":
                request.userVerificationPreference = .required
            case "discouraged":
                request.userVerificationPreference = .discouraged
            default:
                request.userVerificationPreference = .preferred
            }
        }

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        self.controller = controller
        controller.performRequests()
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        presentationAnchor
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard !didComplete else { return }
        didComplete = true
        onFinish()

        guard let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion else {
            continuation.resume(throwing: PasskeyServiceError.invalidResponse)
            return
        }

        continuation.resume(returning: credential)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard !didComplete else { return }
        didComplete = true
        onFinish()

        if let authError = error as? ASAuthorizationError {
            switch authError.code {
            case .canceled:
                continuation.resume(throwing: PasskeyServiceError.cancelled)
            case .notInteractive:
                continuation.resume(throwing: PasskeyServiceError.unsupportedDevice)
            default:
                continuation.resume(throwing: authError)
            }
            return
        }

        continuation.resume(throwing: error)
    }
}

// MARK: - Base64URL helpers

extension Data {
    init?(base64URLEncoded value: String) {
        var normalized = value.replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = normalized.count % 4
        if remainder > 0 {
            normalized.append(String(repeating: "=", count: 4 - remainder))
        }
        self.init(base64Encoded: normalized)
    }

    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}