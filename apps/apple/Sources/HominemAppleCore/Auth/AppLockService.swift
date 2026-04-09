import Foundation
import LocalAuthentication
import Observation

// MARK: - AppLockState

public enum AppLockState: Equatable, Sendable {
    /// Lock not configured or biometrics not available.
    case unavailable
    /// Configured and currently unlocked.
    case unlocked
    /// Configured and currently locked — must authenticate to proceed.
    case locked
    /// Authentication is in progress.
    case authenticating
    /// Last authentication attempt failed.
    case failed(String)
}

// MARK: - AppLockService

/// Manages Face ID / Touch ID / passcode app-lock.
///
/// Persists the user's preference in `UserDefaults` under `appLock.enabled`.
/// The lock is re-engaged every time the app moves to the background.
@Observable
@MainActor
public final class AppLockService {
    // MARK: Public

    public private(set) var state: AppLockState = .unavailable
    public private(set) var biometryType: LABiometryType = .none

    public var isEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: Keys.enabled) }
        set {
            UserDefaults.standard.set(newValue, forKey: Keys.enabled)
            if newValue {
                // Immediately lock when the feature is turned on
                if biometryType != .none {
                    state = .locked
                }
            } else {
                state = biometryType == .none ? .unavailable : .unlocked
            }
        }
    }

    // MARK: Private

    private enum Keys {
        static let enabled = "appLock.enabled"
    }

    public init() {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
        biometryType = available ? context.biometryType : .none
        if !available {
            state = .unavailable
        } else if UserDefaults.standard.bool(forKey: Keys.enabled) {
            state = .locked
        } else {
            state = .unlocked
        }
    }

    // MARK: - Public API

    /// Called when the app enters the foreground — show lock screen if enabled.
    public func engageLockIfNeeded() {
        guard biometryType != .none, isEnabled else { return }
        state = .locked
    }

    /// Prompt the user to unlock with biometrics / passcode.
    public func unlock() async {
        guard case .locked = state else { return }

        state = .authenticating

        let context = LAContext()
        let reason = lockReason

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason
            )
            state = success ? .unlocked : .locked
        } catch {
            // LAError.userCancel means user dismissed — go back to .locked
            let laError = error as? LAError
            if laError?.code == .userCancel || laError?.code == .systemCancel {
                state = .locked
            } else {
                state = .failed(error.localizedDescription)
            }
        }
    }

    /// Reset a failed state back to locked.
    public func resetFailedState() {
        if case .failed = state { state = .locked }
    }

    // MARK: - Private

    private var lockReason: String {
        switch biometryType {
        case .faceID: return "Use Face ID to unlock Hominem."
        case .touchID: return "Use Touch ID to unlock Hominem."
        default: return "Enter your passcode to unlock Hominem."
        }
    }

    // MARK: - Convenience label

    public var biometryLabel: String {
        switch biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        default: return "Passcode"
        }
    }
}
