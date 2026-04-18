import AuthenticationServices
import Foundation
import UIKit

// MARK: - Models

struct ManagedPasskey: Identifiable, Sendable {
    let id: String
    let name: String
}

// MARK: - Registration models

private struct PasskeyRegisterOptions: Decodable, Sendable {
    struct RPInfo: Decodable, Sendable { let id: String }
    struct UserInfo: Decodable, Sendable {
        let id: String
        let name: String
        let displayName: String
    }
    let challenge: String
    let rp: RPInfo
    let user: UserInfo
}

private struct PasskeyRegistrationPayload: Encodable, Sendable {
    struct CredentialResponse: Encodable, Sendable {
        let clientDataJSON: String
        let attestationObject: String
    }
    let id: String
    let rawId: String
    let type: String
    let response: CredentialResponse
}

// MARK: - PasskeyManagementService

@MainActor
enum PasskeyManagementService {

    private static var activeSession: PasskeyRegistrationSession?

    // MARK: - GET /api/auth/passkey/list-user-passkeys

    static func listPasskeys() async throws -> [ManagedPasskey] {
        var request = URLRequest(url: AuthService.apiURL("/api/auth/passkey/list-user-passkeys"))
        request.timeoutInterval = 15
        for (k, v) in AuthProvider.shared.getAuthHeaders() { request.setValue(v, forHTTPHeaderField: k) }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            return []
        }

        guard let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }

        return arr.compactMap { dict -> ManagedPasskey? in
            guard let id = dict["id"] as? String else { return nil }
            let name = dict["name"] as? String ?? "Passkey"
            return ManagedPasskey(id: id, name: name)
        }
    }

    // MARK: - Add passkey (full registration ceremony)

    static func addPasskey(name: String? = nil) async throws {
        // 1. Fetch registration options
        let options = try await fetchRegisterOptions()

        // 2. Run platform registration
        let registration = try await register(with: options)

        // 3. Verify with server
        try await verifyRegistration(registration, options: options)
    }

    private static func fetchRegisterOptions() async throws -> PasskeyRegisterOptions {
        var request = URLRequest(url: AuthService.apiURL("/api/auth/passkey/generate-register-options"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode([String: String]())
        request.timeoutInterval = 15
        for (k, v) in AuthProvider.shared.getAuthHeaders() { request.setValue(v, forHTTPHeaderField: k) }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw PasskeyServiceError.invalidOptions
        }

        return try JSONDecoder().decode(PasskeyRegisterOptions.self, from: data)
    }

    private static func register(
        with options: PasskeyRegisterOptions
    ) async throws -> ASAuthorizationPlatformPublicKeyCredentialRegistration {
        guard let presentationAnchor = currentPresentationAnchor() else {
            throw PasskeyServiceError.missingPresentationAnchor
        }
        guard let challenge = Data(base64URLEncoded: options.challenge) else {
            throw PasskeyServiceError.invalidOptions
        }
        guard let userID = Data(base64URLEncoded: options.user.id) else {
            throw PasskeyServiceError.invalidOptions
        }

        return try await withCheckedThrowingContinuation { continuation in
            let session = PasskeyRegistrationSession(
                presentationAnchor: presentationAnchor,
                challenge: challenge,
                rpID: options.rp.id,
                userID: userID,
                userName: options.user.name,
                displayName: options.user.displayName,
                continuation: continuation,
                onFinish: { activeSession = nil }
            )
            activeSession = session
            session.start()
        }
    }

    private static func verifyRegistration(
        _ credential: ASAuthorizationPlatformPublicKeyCredentialRegistration,
        options: PasskeyRegisterOptions
    ) async throws {
        let credentialID = credential.credentialID.base64URLEncodedString()
        let payload = PasskeyRegistrationPayload(
            id: credentialID,
            rawId: credentialID,
            type: "public-key",
            response: .init(
                clientDataJSON: credential.rawClientDataJSON.base64URLEncodedString(),
                attestationObject: credential.rawAttestationObject?.base64URLEncodedString() ?? ""
            )
        )

        var request = URLRequest(url: AuthService.apiURL("/api/auth/passkey/verify-registration"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["response": payload])
        request.timeoutInterval = 20
        for (k, v) in AuthProvider.shared.getAuthHeaders() { request.setValue(v, forHTTPHeaderField: k) }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let msg = AuthService.extractMessage(from: data) ?? "Could not add passkey."
            throw AuthError.serverError(msg)
        }
    }

    // MARK: - POST /api/auth/passkey/delete-passkey

    static func deletePasskey(id: String) async throws {
        var request = URLRequest(url: AuthService.apiURL("/api/auth/passkey/delete-passkey"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["id": id])
        request.timeoutInterval = 15
        for (k, v) in AuthProvider.shared.getAuthHeaders() { request.setValue(v, forHTTPHeaderField: k) }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let msg = AuthService.extractMessage(from: data) ?? "Could not remove passkey."
            throw AuthError.serverError(msg)
        }
    }

    // MARK: - Helpers

    private static func currentPresentationAnchor() -> UIWindow? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first(where: { $0.isKeyWindow })
    }
}

// MARK: - Registration session

@MainActor
private final class PasskeyRegistrationSession: NSObject,
    ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding
{
    private let presentationAnchor: UIWindow
    private let challenge: Data
    private let rpID: String
    private let userID: Data
    private let userName: String
    private let displayName: String
    private let continuation: CheckedContinuation<ASAuthorizationPlatformPublicKeyCredentialRegistration, Error>
    private let onFinish: () -> Void
    private var controller: ASAuthorizationController?
    private var didComplete = false

    init(
        presentationAnchor: UIWindow,
        challenge: Data,
        rpID: String,
        userID: Data,
        userName: String,
        displayName: String,
        continuation: CheckedContinuation<ASAuthorizationPlatformPublicKeyCredentialRegistration, Error>,
        onFinish: @escaping () -> Void
    ) {
        self.presentationAnchor = presentationAnchor
        self.challenge = challenge
        self.rpID = rpID
        self.userID = userID
        self.userName = userName
        self.displayName = displayName
        self.continuation = continuation
        self.onFinish = onFinish
    }

    func start() {
        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpID)
        let request = provider.createCredentialRegistrationRequest(
            challenge: challenge,
            name: userName,
            userID: userID
        )
        request.displayName = displayName
        request.userVerificationPreference = .preferred

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        self.controller = controller
        controller.performRequests()
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        presentationAnchor
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard !didComplete else { return }
        didComplete = true
        onFinish()
        guard let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration else {
            continuation.resume(throwing: PasskeyServiceError.invalidResponse)
            return
        }
        continuation.resume(returning: credential)
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        guard !didComplete else { return }
        didComplete = true
        onFinish()
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            continuation.resume(throwing: PasskeyServiceError.cancelled)
        } else {
            continuation.resume(throwing: error)
        }
    }
}
