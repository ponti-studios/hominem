import AuthenticationServices
import Foundation
#if canImport(AppKit)
import AppKit
#endif
#if canImport(UIKit)
import UIKit
#endif

@MainActor
public protocol PasskeyProviding: AnyObject {
    func register(using options: PasskeyRegistrationOptions) async throws -> PasskeyRegistrationResponse
    func authenticate(using options: PasskeyAuthenticationOptions) async throws -> PasskeyAuthenticationResponse
}

@MainActor
public final class SystemPasskeyProvider: NSObject, PasskeyProviding {
    public override init() {}

    public func register(using options: PasskeyRegistrationOptions) async throws -> PasskeyRegistrationResponse {
        let challenge = try Base64URL.decode(options.challenge)
        let userID = try Base64URL.decode(options.user.id)
        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: options.rp.id)
        let request = provider.createCredentialRegistrationRequest(
            challenge: challenge,
            name: options.user.name,
            userID: userID
        )
        request.userVerificationPreference = userVerificationPreference(options.authenticatorSelection?.userVerification)

        let credential = try await authorize(with: [request])

        guard let registration = credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration else {
            throw PasskeyError.invalidPayload
        }

        return PasskeyRegistrationResponse(
            id: Base64URL.encode(registration.credentialID),
            rawId: Base64URL.encode(registration.credentialID),
            response: .init(
                clientDataJSON: Base64URL.encode(registration.rawClientDataJSON),
                attestationObject: Base64URL.encode(registration.rawAttestationObject ?? Data()),
                transports: ["internal"]
            ),
            type: "public-key",
            authenticatorAttachment: "platform",
            clientExtensionResults: [:]
        )
    }

    public func authenticate(using options: PasskeyAuthenticationOptions) async throws -> PasskeyAuthenticationResponse {
        let rpID = options.rpId ?? ""
        guard rpID.isEmpty == false else {
            throw PasskeyError.invalidPayload
        }

        let challenge = try Base64URL.decode(options.challenge)
        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpID)
        let request = provider.createCredentialAssertionRequest(challenge: challenge)
        request.allowedCredentials = try options.allowCredentials?.map {
            ASAuthorizationPlatformPublicKeyCredentialDescriptor(credentialID: try Base64URL.decode($0.id))
        } ?? []
        request.userVerificationPreference = userVerificationPreference(options.userVerification)

        let credential = try await authorize(with: [request])

        guard let assertion = credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion else {
            throw PasskeyError.invalidPayload
        }

        return PasskeyAuthenticationResponse(
            id: Base64URL.encode(assertion.credentialID),
            rawId: Base64URL.encode(assertion.credentialID),
            response: .init(
                clientDataJSON: Base64URL.encode(assertion.rawClientDataJSON),
                authenticatorData: Base64URL.encode(assertion.rawAuthenticatorData),
                signature: Base64URL.encode(assertion.signature),
                userHandle: assertion.userID.isEmpty ? nil : Base64URL.encode(assertion.userID)
            ),
            type: "public-key",
            authenticatorAttachment: "platform",
            clientExtensionResults: [:]
        )
    }

    private func userVerificationPreference(_ value: String?) -> ASAuthorizationPublicKeyCredentialUserVerificationPreference {
        guard let value else {
            return .preferred
        }
        return ASAuthorizationPublicKeyCredentialUserVerificationPreference(rawValue: value)
    }

    private func authorize(with requests: [ASAuthorizationRequest]) async throws -> ASAuthorizationCredential {
        try await withCheckedThrowingContinuation { continuation in
            let coordinator = AuthorizationCoordinator(continuation: continuation)
            let controller = ASAuthorizationController(authorizationRequests: requests)
            controller.delegate = coordinator
            controller.presentationContextProvider = coordinator
            coordinator.bind(controller)
            controller.performRequests()
        }
    }
}

@MainActor
private final class AuthorizationCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private static var retainers: [UUID: AuthorizationCoordinator] = [:]

    private let id = UUID()
    private let continuation: CheckedContinuation<ASAuthorizationCredential, Error>
    private weak var controller: ASAuthorizationController?

    init(continuation: CheckedContinuation<ASAuthorizationCredential, Error>) {
        self.continuation = continuation
        super.init()
        Self.retainers[id] = self
    }

    func bind(_ controller: ASAuthorizationController) {
        self.controller = controller
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        #if canImport(UIKit)
        if let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first,
           let window = scene.windows.first(where: \.isKeyWindow) ?? scene.windows.first {
            return window
        }
        #elseif canImport(AppKit)
        if let window = NSApp.keyWindow ?? NSApp.windows.first {
            return window
        }
        #endif

        return ASPresentationAnchor()
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        releaseSelf()
        continuation.resume(returning: authorization.credential)
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        releaseSelf()

        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            continuation.resume(throwing: PasskeyError.cancelled)
            return
        }

        continuation.resume(throwing: error)
    }

    private func releaseSelf() {
        Self.retainers.removeValue(forKey: id)
    }
}
