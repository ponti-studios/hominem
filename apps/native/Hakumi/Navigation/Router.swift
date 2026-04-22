import SwiftUI

// MARK: - Router
// Single source of truth for all navigation state.

@Observable
@MainActor
final class Router {

    // MARK: Auth phase
    var authPhase: AuthPhase = .booting

    // MARK: Stack paths
    var authPath: [AuthRoute] = []
    var protectedPath: [ProtectedRoute] = []   // inbox tab
    var notesPath: [ProtectedRoute] = []       // notes tab
    var settingsPath: [ProtectedRoute] = []    // settings tab
    var selectedTab: ProtectedTab = .inbox

    // MARK: Pending deep link (buffered while booting)
    private var pendingRoute: AppRoute?

    // MARK: - Boot sequence

    func bootstrap() {
        StartupMetrics.mark(.rootLayoutMounted)
        Task {
            StartupMetrics.mark(.authBootStart)
            await runBootSequence()
            StartupMetrics.mark(.authBootResolved)
            StartupMetrics.mark(.shellReady)
            Observability.captureStartupBaseline()
            flushPendingRoute()
        }
    }

    private func runBootSequence() async {
        let result = await BootService.run()
        switch result {
        case .sessionLoaded(let user, let cookie):
            AuthProvider.shared.restoreSession(user: user, cookie: cookie)
            let needsOnboarding = user.name == nil || user.name?.trimmingCharacters(in: .whitespaces).isEmpty == true
            authPhase = needsOnboarding ? .onboarding : .authenticated
        case .sessionExpired:
            authPhase = .unauthenticated
        }
    }

    /// Called after a successful sign-in. Routes to onboarding if name is unset,
    /// otherwise directly to the protected shell.
    func completeAuthentication() {
        authPath = []
        protectedPath = []
        notesPath = []
        settingsPath = []
        selectedTab = .inbox
        let user = AuthProvider.shared.currentUser
        let needsOnboarding = user?.name == nil || user?.name?.trimmingCharacters(in: .whitespaces).isEmpty == true
        authPhase = needsOnboarding ? .onboarding : .authenticated
        if authPhase == .authenticated {
            flushPendingRoute()
        }
    }

    func resetForSignOut() {
        pendingRoute = nil
        authPhase = .unauthenticated
        authPath = []
        protectedPath = []
        notesPath = []
        settingsPath = []
        selectedTab = .inbox
    }

    // MARK: - Deep link handling

    func handle(url: URL) {
        let route = DeepLinkParser.parse(url) ?? .notFound
        if authPhase == .booting {
            pendingRoute = route
        } else {
            navigate(to: route)
        }
    }

    func navigate(to route: AppRoute) {
        switch route {
        case .inbox:
            guard ensureAuthenticatedForProtectedRoute(route) else { return }
            selectedTab = .inbox
            protectedPath = []

        case .notesList:
            guard ensureAuthenticatedForProtectedRoute(route) else { return }
            selectedTab = .notes
            protectedPath = []

        case .noteDetail(let id):
            guard ensureAuthenticatedForProtectedRoute(route) else { return }
            selectedTab = .notes
            notesPath = [.noteDetail(id: id)]

        case .chat(let id):
            guard ensureAuthenticatedForProtectedRoute(route) else { return }
            selectedTab = .inbox
            protectedPath = [.chat(id: id)]

        case .settings:
            guard ensureAuthenticatedForProtectedRoute(route) else { return }
            selectedTab = .settings
            settingsPath = []

        case .archivedChats:
            guard ensureAuthenticatedForProtectedRoute(route) else { return }
            selectedTab = .settings
            settingsPath = [.archivedChats]

        case .auth:
            authPhase = .unauthenticated
            authPath = []

        case .onboarding:
            authPhase = .onboarding

        case .error, .notFound:
            break // handled inline by RootView
        }
    }

    // MARK: - Private

    private func ensureAuthenticatedForProtectedRoute(_ route: AppRoute) -> Bool {
        guard authPhase == .authenticated else {
            pendingRoute = route
            authPhase = .unauthenticated
            authPath = []
            return false
        }
        return true
    }

    private func flushPendingRoute() {
        guard let route = pendingRoute else { return }
        pendingRoute = nil
        navigate(to: route)
    }
}
