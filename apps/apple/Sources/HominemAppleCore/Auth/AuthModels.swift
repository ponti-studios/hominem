import Foundation

public struct AuthUser: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let email: String
    public let name: String?
    public let image: String?
    public let emailVerified: Bool?
    public let createdAt: String?
    public let updatedAt: String?

    public init(
        id: String,
        email: String,
        name: String? = nil,
        image: String? = nil,
        emailVerified: Bool? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil
    ) {
        self.id = id
        self.email = email
        self.name = name
        self.image = image
        self.emailVerified = emailVerified
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct AuthSessionDetails: Codable, Equatable, Sendable {
    public let id: String
    public let token: String
    public let expiresAt: String?

    public init(id: String, token: String, expiresAt: String? = nil) {
        self.id = id
        self.token = token
        self.expiresAt = expiresAt
    }
}

public struct AuthSession: Codable, Equatable, Sendable {
    public let user: AuthUser
    public let session: AuthSessionDetails

    public init(user: AuthUser, session: AuthSessionDetails) {
        self.user = user
        self.session = session
    }
}

public struct RegisteredPasskey: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String?
    public let createdAt: String?

    public init(id: String, name: String? = nil, createdAt: String? = nil) {
        self.id = id
        self.name = name
        self.createdAt = createdAt
    }
}

struct SuccessEnvelope: Codable, Equatable, Sendable {
    let success: Bool
}

struct EmailOTPSignInEnvelope: Codable, Equatable, Sendable {
    let token: String
    let user: AuthUser
}

struct APIErrorEnvelope: Codable, Equatable, Sendable {
    let code: String?
    let error: String?
    let message: String?

    var bestMessage: String {
        message ?? error ?? code ?? "Request failed."
    }
}
