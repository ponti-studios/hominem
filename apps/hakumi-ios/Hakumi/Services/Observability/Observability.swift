import SwiftUI

// MARK: - Config

private enum ObservabilityConfig {
    static var apiKey: String {
        Bundle.main.object(forInfoDictionaryKey: "PostHogAPIKey") as? String ?? ""
    }
    static var host: String {
        Bundle.main.object(forInfoDictionaryKey: "PostHogHost") as? String ?? "https://us.i.posthog.com"
    }
    // Disabled when no API key is set (dev / e2e builds have empty key).
    static var isEnabled: Bool { !apiKey.isEmpty }
}

// MARK: - Observability
// Thin facade. PostHog SDK wiring is deferred to the observability work item.
// All methods are no-ops until the SDK is integrated.

@MainActor
enum Observability {

    static func setup() {
        // PostHog SDK setup — pending wire-posthog work item
    }

    static func capture(_ event: String, properties: [String: Any] = [:]) {
        // no-op until PostHog is wired
    }

    static func identify(userId: String, email: String?) {
        // no-op
    }

    static func reset() {
        // no-op
    }

    static func flush() {
        // no-op
    }

    // MARK: Startup baseline events

    static func captureStartupBaseline() {
        let phases = StartupMetrics.snapshot()
        guard !phases.isEmpty else { return }
        capture("app_startup_baseline", properties: phases)
    }
}

// MARK: - Scene phase observer

struct AppLifecycleObserver: ViewModifier {
    @Environment(\.scenePhase) private var scenePhase

    func body(content: Content) -> some View {
        content.onChange(of: scenePhase) { _, phase in
            if phase == .background {
                Observability.flush()
            }
        }
    }
}

extension View {
    func appLifecycleObserver() -> some View {
        modifier(AppLifecycleObserver())
    }
}
