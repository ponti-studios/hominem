// MARK: - Authentication State Machine
// This file implements the auth state machine that manages the user's authentication status.
// It uses a reducer pattern (similar to Redux) for predictable state transitions.

import Foundation

// MARK: - Authentication Status Enum

/// Represents all possible authentication states the app can be in
///
/// The status acts as a state machine that controls:
/// - Which UI screens are shown (auth flow vs main app)
/// - Which API operations can be performed
/// - User-facing status messages
///
/// State transitions:
/// - booting → signedOut/signedIn (on app launch)
/// - signedOut → sendingOTP → awaitingOTP → verifyingOTP → signingInWithPasskey → signedIn
/// - signedOut → registeringPasskey → signedIn
/// - signedIn → signingOut → signedOut
/// - Any state → degraded (on error)
/// - degraded → signedIn/signedOut (after error cleared)
public enum AuthStatus: String, Codable, Equatable, Sendable {
    /// App is starting up, checking for existing session
    case booting

    /// No active session, user needs to authenticate
    case signedOut

    /// Email OTP authentication: sending email with one-time password
    case sendingOTP

    /// Email OTP authentication: waiting for user to enter the code from email
    case awaitingOTP

    /// Email OTP authentication: verifying the code user entered
    case verifyingOTP

    /// Passkey authentication: requesting system passkey/biometric auth
    case signingInWithPasskey

    /// User is signing out and clearing session
    case signingOut

    /// Fetching list of user's registered passkeys
    case refreshingPasskeys

    /// User is registering a new passkey
    case registeringPasskey

    /// User is deleting an existing passkey
    case deletingPasskey

    /// User is authenticated and can use the app
    case signedIn

    /// Error occurred but not critical (e.g., failed to refresh passkeys)
    /// User can still use the app, but some features may be limited
    case degraded
}

// MARK: - Authentication State Struct

/// The complete authentication state of the application
///
/// This struct is the single source of truth for all auth-related information.
/// It contains:
/// - Current auth status (what screen should be shown)
/// - Active session (if user is signed in)
/// - Pending authentication data (e.g., email waiting for OTP)
/// - List of user's passkeys
/// - Error messages for display
///
/// Conformances:
/// - Equatable: Can compare two auth states (useful for testing)
/// - Sendable: Can safely pass across thread boundaries (Swift concurrency)
public struct AuthState: Equatable, Sendable {
    /// Current authentication status (see AuthStatus enum)
    /// This determines which UI is shown and what operations are possible
    public var status: AuthStatus

    /// Active session with auth token and user information
    /// Nil when user is not signed in
    /// Contains credentials needed to make authenticated API requests
    public var session: AuthSession?

    /// Email address currently being authenticated
    /// Used in email OTP flow to remember which email the user is verifying
    /// Empty string when not in OTP flow
    public var pendingEmail: String

    /// List of passkeys the user has registered
    /// These are available for signing in (passkeys work like TouchID/FaceID)
    /// Empty list when user not signed in or passkeys not yet loaded
    public var passkeys: [RegisteredPasskey]

    /// Human-readable error message for display to user
    /// Shown when an operation fails
    /// Nil when no error has occurred
    public var errorMessage: String?

    /// Initialize AuthState with explicit values
    /// - Parameters:
    ///   - status: Current authentication status (default: .booting)
    ///   - session: Active session if signed in (default: nil)
    ///   - pendingEmail: Email waiting for verification (default: "")
    ///   - passkeys: List of registered passkeys (default: [])
    ///   - errorMessage: Error message if operation failed (default: nil)
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

// MARK: - Authentication Actions

/// Actions that can be dispatched to change authentication state
///
/// In the reducer pattern, actions describe "what happened" (past tense)
/// rather than "what to do" (imperative). The reducer then decides how to update state.
///
/// Usage:
/// let newState = reduceAuthState(currentState, .sessionLoaded(session))
public enum AuthAction: Equatable, Sendable {
    /// App launched and is checking for existing session
    case bootStarted

    /// Existing session was found and loaded from storage
    /// Associated value: the loaded session
    case sessionLoaded(AuthSession)

    /// No existing session found, user needs to authenticate
    case sessionMissing

    /// User started email OTP sign-in with given email address
    /// Associated value: the email address to send OTP to
    case emailOTPStarted(String)

    /// Email with OTP code was successfully sent to user
    case emailOTPSent

    /// User is now verifying the OTP code they received
    case emailOTPVerificationStarted

    /// User requested passkey sign-in (will show system UI)
    case passkeySignInStarted

    /// App is loading the list of user's registered passkeys
    case passkeysRefreshStarted

    /// Passkeys were successfully loaded from server
    /// Associated value: array of registered passkeys
    case passkeysLoaded([RegisteredPasskey])

    /// User started registering a new passkey
    case passkeyRegistrationStarted

    /// User started deleting an existing passkey
    case passkeyDeletionStarted

    /// User initiated sign-out
    case signOutStarted

    /// An operation failed with an error
    /// Associated value: human-readable error message
    case failed(String)

    /// Clear the current error message and restore normal status
    case clearError
}

// MARK: - Authentication State Reducer

/// Pure function that computes new auth state from current state and an action
///
/// This is a reducer in the Redux/Elm sense: given a state and an action, produce a new state.
/// Benefits:
/// - Predictable: Same state + same action always produces same result
/// - Testable: Easy to write unit tests for all state transitions
/// - Debuggable: Can log/replay all state changes
/// - Concurrent-safe: Pure function with no side effects
///
/// - Parameters:
///   - state: Current authentication state
///   - action: Action describing what happened
/// - Returns: New authentication state
public func reduceAuthState(_ state: AuthState, _ action: AuthAction) -> AuthState {
    var next = state

    switch action {
    // MARK: App Boot
    case .bootStarted:
        // App is launching, check for existing session
        next.status = .booting
        next.errorMessage = nil // Clear any previous errors

    // MARK: Session Loading
    case .sessionLoaded(let session):
        // Found a valid session from storage
        next.status = .signedIn
        next.session = session
        next.errorMessage = nil

    case .sessionMissing:
        // No session found, user needs to authenticate
        next.status = .signedOut
        next.session = nil
        next.passkeys = [] // Clear passkeys since we're not signed in
        next.errorMessage = nil

    // MARK: Email OTP Flow
    case .emailOTPStarted(let email):
        // User entered email and requested OTP
        next.status = .sendingOTP
        next.pendingEmail = email // Save email for later verification
        next.errorMessage = nil

    case .emailOTPSent:
        // OTP email was successfully sent
        next.status = .awaitingOTP // Now wait for user to enter the code
        next.errorMessage = nil

    case .emailOTPVerificationStarted:
        // User is verifying the OTP code
        next.status = .verifyingOTP
        next.errorMessage = nil

    // MARK: Passkey Sign-In
    case .passkeySignInStarted:
        // User initiated passkey auth (system will show biometric UI)
        next.status = .signingInWithPasskey
        next.errorMessage = nil

    // MARK: Passkey Management
    case .passkeysRefreshStarted:
        // Refreshing the list of user's passkeys from server
        next.status = .refreshingPasskeys
        next.errorMessage = nil

    case .passkeysLoaded(let passkeys):
        // Successfully loaded user's passkeys from server
        next.passkeys = passkeys
        // Keep status aligned with session: signed in if we have session, out if not
        next.status = next.session == nil ? .signedOut : .signedIn
        next.errorMessage = nil

    case .passkeyRegistrationStarted:
        // User is registering a new passkey (system will show biometric UI)
        next.status = .registeringPasskey
        next.errorMessage = nil

    case .passkeyDeletionStarted:
        // User is deleting an existing passkey
        next.status = .deletingPasskey
        next.errorMessage = nil

    // MARK: Sign Out
    case .signOutStarted:
        // User initiated sign-out
        next.status = .signingOut
        next.errorMessage = nil
        // Note: session cleared in a separate action when sign-out completes

    // MARK: Error Handling
    case .failed(let message):
        // Operation failed
        // Stay in degraded state if no session, otherwise stay signed in
        // This allows app to partially work even if one operation fails
        next.status = next.session == nil ? .degraded : .signedIn
        next.errorMessage = message // Show error to user

    case .clearError:
        // User dismissed error, clear error message
        next.errorMessage = nil
        // If we were in degraded state (temporary error), restore normal status
        if next.status == .degraded {
            // Go back to signedOut or signedIn based on session
            next.status = next.session == nil ? .signedOut : .signedIn
        }
    }

    return next
}
