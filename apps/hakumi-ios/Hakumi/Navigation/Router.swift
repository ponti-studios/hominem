import SwiftUI

// MARK: - Router
// Single source of truth for all navigation state.

@Observable
@MainActor
final class Router {

    // MARK: Auth phase
    var authPhase: AuthPhase = .booting

    // MARK: Auth stack
    var authPath: [AuthRoute] = []

    // MARK: Sidebar / detail selection
    /// The item currently shown in the detail column. nil = empty detail (feed composer).
    var sidebarSelection: ProtectedRoute? = nil

    // MARK: Settings
    var showSettings: Bool = false
    var settingsPath: [ProtectedRoute] = []

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

    func completeAuthentication() {
        authPath = []
        sidebarSelection = nil
        showSettings = false
        settingsPath = []
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
        sidebarSelection = nil
        showSettings = false
        settingsPath = []
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
        case .inbox, .notesList:
            guard ensureAuthenticatedForProtectedRoute(route) else { return }
            sidebarSelection = nil
            showSettings = false

        case .noteDetail(let id):
            guard ensureAuthenticatedForProtectedRoute(route) else { return }
            sidebarSelection = .noteDetail(id: id)
            showSettings = false

        case .chat(let id):
            guard ensureAuthenticatedForProtectedRoute(route) else { return }
            sidebarSelection = .chat(id: id)
            showSettings = false

        case .settings:
            guard ensureAuthenticatedForProtectedRoute(route) else { return }
            showSettings = true

        case .archivedChats:
            guard ensureAuthenticatedForProtectedRoute(route) else { return }
            showSettings = true
            settingsPath = [.archivedChats]

        case .auth:
            authPhase = .unauthenticated
            authPath = []

        case .onboarding:
            authPhase = .onboarding

        case .error, .notFound:
            break
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
