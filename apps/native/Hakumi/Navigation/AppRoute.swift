import Foundation

// MARK: - Auth phase
// Maps directly to auth-route-guard.ts's AuthStatusCompat states.

enum AuthPhase: Equatable {
    case booting
    case unauthenticated
    case onboarding
    case authenticated
}

// MARK: - Auth navigation stack routes

enum AuthRoute: Hashable {
    case verifyOTP(email: String)
}

// MARK: - Protected navigation stack routes

enum ProtectedRoute: Hashable {
    case noteDetail(id: String)
    case chat(id: String)
    case archivedChats
}

// MARK: - Active protected tab

enum ProtectedTab: Hashable {
    case inbox
    case notes
    case settings
}

// MARK: - Top-level deep-link destination
// Parsed from hakumi:// or https://hakumi.app/ URLs.
// The router resolves these into AuthPhase + path changes.

enum AppRoute: Equatable {
    case inbox
    case notesList
    case noteDetail(id: String)
    case chat(id: String)
    case settings
    case archivedChats
    case auth
    case onboarding
    case error
    case notFound
}
