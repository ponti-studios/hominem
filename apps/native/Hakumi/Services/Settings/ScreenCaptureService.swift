import Foundation

// MARK: - ScreenCaptureService
//
// Stores the "prevent screenshots" preference and exposes it as observable state.
// Full enforcement (UITextField isSecureTextEntry overlay) is a later device-control work item.
// Phase 3 scope: settings-surface toggle + .privacySensitive() on sensitive views.

@Observable
@MainActor
final class ScreenCaptureService {
    static let shared = ScreenCaptureService()

    private let key = "com.hakumi.preventScreenshots"

    var isPreventingScreenshots: Bool {
        didSet {
            UserDefaults.standard.set(isPreventingScreenshots, forKey: key)
        }
    }

    private init() {
        isPreventingScreenshots = UserDefaults.standard.bool(forKey: "com.hakumi.preventScreenshots")
    }
}
