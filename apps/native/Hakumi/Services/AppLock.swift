import LocalAuthentication
import SwiftUI

// MARK: - AppLock
// Foundation for biometric app-lock behavior.
// Mirrors use-app-lock.ts: reads a stored enabled flag, authenticates on
// mount and on foreground restore, and re-locks when the app backgrounds.
//
// Full settings toggle is delivered in Phase 5 (device controls).

@Observable
@MainActor
final class AppLock {

    // MARK: - Singleton

    static let shared = AppLock()

    // MARK: - State

    /// Whether app-lock is turned on by the user. Persisted in UserDefaults.
    var isEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: Self.enabledKey) }
        set { UserDefaults.standard.set(newValue, forKey: Self.enabledKey) }
    }

    /// Whether the user has successfully authenticated this session.
    /// Starts as `true` when lock is disabled, `false` when enabled.
    private(set) var isUnlocked: Bool = true

    private static let enabledKey = "appLockEnabled"

    // MARK: - Init

    private init() {
        isUnlocked = !isEnabled
    }

    // MARK: - Authentication

    /// Prompt for biometric or passcode authentication.
    /// No-ops if lock is disabled or already unlocked.
    func authenticate() async {
        guard isEnabled, !isUnlocked else {
            isUnlocked = true
            return
        }

        let context = LAContext()
        var error: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            // No biometrics and no passcode available — unlock unconditionally
            isUnlocked = true
            return
        }

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: "Unlock Hakumi"
            )
            isUnlocked = success
        } catch {
            // User cancelled or failed — remain locked
        }
    }

    /// Called when the app enters the foreground after being backgrounded.
    func lock() {
        guard isEnabled else { return }
        isUnlocked = false
    }
}

// MARK: - AppLockObserver
// Attach to the protected shell root to automatically re-lock on background
// and prompt authentication on foreground, matching the Expo useAppLock behavior.

struct AppLockObserver: ViewModifier {
    @Environment(\.scenePhase) private var scenePhase
    private let appLock = AppLock.shared

    func body(content: Content) -> some View {
        content
            .task { await appLock.authenticate() }
            .onChange(of: scenePhase) { _, phase in
                switch phase {
                case .background:
                    appLock.lock()
                case .active:
                    Task { await appLock.authenticate() }
                default:
                    break
                }
            }
    }
}

extension View {
    func appLockObserver() -> some View {
        modifier(AppLockObserver())
    }
}
