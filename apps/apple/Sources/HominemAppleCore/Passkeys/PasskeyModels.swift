import Foundation

public struct PasskeyRegistrationOptions: Codable, Equatable, Sendable {
    public struct RelyingParty: Codable, Equatable, Sendable {
        public let id: String
        public let name: String
    }

    public struct User: Codable, Equatable, Sendable {
        public let id: String
        public let name: String
        public let displayName: String
    }

    public struct Parameter: Codable, Equatable, Sendable {
        public let type: String
        public let alg: Int
    }

    public struct Descriptor: Codable, Equatable, Sendable {
        public let id: String
        public let type: String
        public let transports: [String]?
    }

    public struct AuthenticatorSelection: Codable, Equatable, Sendable {
        public let authenticatorAttachment: String?
        public let requireResidentKey: Bool?
        public let userVerification: String?
    }

    public let challenge: String
    public let rp: RelyingParty
    public let user: User
    public let pubKeyCredParams: [Parameter]
    public let timeout: Double?
    public let excludeCredentials: [Descriptor]?
    public let authenticatorSelection: AuthenticatorSelection?
    public let attestation: String?
}

public struct PasskeyAuthenticationOptions: Codable, Equatable, Sendable {
    public struct Descriptor: Codable, Equatable, Sendable {
        public let id: String
        public let type: String
        public let transports: [String]?
    }

    public let challenge: String
    public let rpId: String?
    public let timeout: Double?
    public let allowCredentials: [Descriptor]?
    public let userVerification: String?
}

public struct PasskeyRegistrationResponse: Codable, Equatable, Sendable {
    public struct Payload: Codable, Equatable, Sendable {
        public let clientDataJSON: String
        public let attestationObject: String
        public let transports: [String]
    }

    public let id: String
    public let rawId: String
    public let response: Payload
    public let type: String
    public let authenticatorAttachment: String
    public let clientExtensionResults: [String: String]
}

public struct PasskeyAuthenticationResponse: Codable, Equatable, Sendable {
    public struct Payload: Codable, Equatable, Sendable {
        public let clientDataJSON: String
        public let authenticatorData: String
        public let signature: String
        public let userHandle: String?
    }

    public let id: String
    public let rawId: String
    public let response: Payload
    public let type: String
    public let authenticatorAttachment: String
    public let clientExtensionResults: [String: String]
}

public enum PasskeyError: Error, LocalizedError, Equatable {
    case cancelled
    case invalidPayload
    case unsupported
    case unavailable

    public var errorDescription: String? {
        switch self {
        case .cancelled:
            return "The passkey request was cancelled."
        case .invalidPayload:
            return "The passkey payload was invalid."
        case .unsupported:
            return "Passkeys are not available on this device."
        case .unavailable:
            return "Unable to present the passkey sheet right now."
        }
    }
}
