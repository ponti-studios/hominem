import Foundation

public enum AuthStatus: String, Codable, Equatable, Sendable {
    case booting
    case signedOut
    case sendingOTP
    case awaitingOTP
    case verifyingOTP
    case signingInWithPasskey
    case signingOut
    case refreshingPasskeys
    case registeringPasskey
    case deletingPasskey
    case signedIn
    case degraded
}

public struct AuthState: Equatable, Sendable {
    public var status: AuthStatus
    public var session: AuthSession?
    public var pendingEmail: String
    public var passkeys: [RegisteredPasskey]
    public var errorMessage: String?

    public init(
        status: AuthStatus = .booting,
        session: AuthSession? = nil,
        pendingEmail: String = "",
        passkeys: [RegisteredPasskey] = [],
        errorMessage: String? = nil
    ) {
        self.status = status
        self.session = session
        self.pendingEmail = pendingEmail
        self.passkeys = passkeys
        self.errorMessage = errorMessage
    }
}

public enum AuthAction: Equatable, Sendable {
    case bootStarted
    case sessionLoaded(AuthSession)
    case sessionMissing
    case emailOTPStarted(String)
    case emailOTPSent
    case emailOTPVerificationStarted
    case passkeySignInStarted
    case passkeysRefreshStarted
    case passkeysLoaded([RegisteredPasskey])
    case passkeyRegistrationStarted
    case passkeyDeletionStarted
    case signOutStarted
    case failed(String)
    case clearError
}

public func reduceAuthState(_ state: AuthState, _ action: AuthAction) -> AuthState {
    var next = state

    switch action {
    case .bootStarted:
        next.status = .booting
        next.errorMessage = nil
    case .sessionLoaded(let session):
        next.status = .signedIn
        next.session = session
        next.errorMessage = nil
    case .sessionMissing:
        next.status = .signedOut
        next.session = nil
        next.passkeys = []
        next.errorMessage = nil
    case .emailOTPStarted(let email):
        next.status = .sendingOTP
        next.pendingEmail = email
        next.errorMessage = nil
    case .emailOTPSent:
        next.status = .awaitingOTP
        next.errorMessage = nil
    case .emailOTPVerificationStarted:
        next.status = .verifyingOTP
        next.errorMessage = nil
    case .passkeySignInStarted:
        next.status = .signingInWithPasskey
        next.errorMessage = nil
    case .passkeysRefreshStarted:
        next.status = .refreshingPasskeys
        next.errorMessage = nil
    case .passkeysLoaded(let passkeys):
        next.passkeys = passkeys
        next.status = next.session == nil ? .signedOut : .signedIn
        next.errorMessage = nil
    case .passkeyRegistrationStarted:
        next.status = .registeringPasskey
        next.errorMessage = nil
    case .passkeyDeletionStarted:
        next.status = .deletingPasskey
        next.errorMessage = nil
    case .signOutStarted:
        next.status = .signingOut
        next.errorMessage = nil
    case .failed(let message):
        next.status = next.session == nil ? .degraded : .signedIn
        next.errorMessage = message
    case .clearError:
        next.errorMessage = nil
        if next.status == .degraded {
            next.status = next.session == nil ? .signedOut : .signedIn
        }
    }

    return next
}
