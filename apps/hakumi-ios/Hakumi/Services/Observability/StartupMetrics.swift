import Foundation

// Mirrors startup-metrics.ts — same phase names for cross-platform baseline comparison.

enum StartupPhase: String {
    case appStart          = "app_start"
    case rootLayoutMounted = "root_layout_mounted"
    case shellReady        = "shell_ready"
    case authBootStart     = "auth_boot_start"
    case authBootResolved  = "auth_boot_resolved"
}

@MainActor
enum StartupMetrics {
    private static var phaseTimes: [StartupPhase: TimeInterval] = [:]
    private static let processStart = Date()

    static func mark(_ phase: StartupPhase) {
        let ms = Date().timeIntervalSince(processStart) * 1000
        phaseTimes[phase] = ms
    }

    // Returns milliseconds since process start for a given phase, or nil if not yet marked.
    static func elapsed(for phase: StartupPhase) -> TimeInterval? {
        phaseTimes[phase]
    }

    // Snapshot of all marked phases — passed to PostHog on shell_ready.
    static func snapshot() -> [String: Double] {
        Dictionary(uniqueKeysWithValues: phaseTimes.map { ($0.key.rawValue, $0.value) })
    }
}
