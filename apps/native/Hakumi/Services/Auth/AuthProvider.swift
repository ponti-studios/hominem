import Foundation

// MARK: - AuthProvider
// Observable singleton that owns the signed-in user and session cookie.
// Mirrors the Expo AuthProvider context: holds auth state, exposes auth headers,
// and manages sign-in/sign-out lifecycle.
//
// Phase 2.2 boot sequence will call loadStoredSession() + probeSession()
// to restore state at launch.

@Observable
@MainActor
final class AuthProvider {

    // MARK: - Singleton

    static let shared = AuthProvider()

    // MARK: - State

    private(set) var currentUser: AuthUser? = nil
    private(set) var sessionCookie: String? = nil

    var isSignedIn: Bool { currentUser != nil }

    // MARK: - Sign-in completion
    // Called by VerifyOTPScreen and AuthSignInScreen after a successful auth response.

    func completeSignIn(user: AuthUser) {
        currentUser = user
        // Extract the session cookie set by the server response
        if let cookie = extractCookieHeader(for: AuthService.apiBaseURL) {
            sessionCookie = cookie
            try? SessionStore.save(cookie)
        }
    }

    // MARK: - Session restore (used by boot sequence in Phase 2.2)

    /// Loads the persisted session cookie from Keychain.
    /// Returns the cookie string if one exists, nil otherwise.
    @discardableResult
    func loadStoredSession() -> String? {
        let stored = SessionStore.load()
        sessionCookie = stored
        // Restore into HTTPCookieStorage so URLSession sends it automatically
        if let stored {
            injectCookies(from: stored, for: AuthService.apiBaseURL)
        }
        return stored
    }

    /// Called by boot sequence when the session probe confirms a valid user.
    func restoreSession(user: AuthUser, cookie: String) {
        currentUser = user
        sessionCookie = cookie
        try? SessionStore.save(cookie)
    }

    // MARK: - Auth headers
    // Use these on all protected API requests until a proper HTTP client
    // middleware layer is added.

    func getAuthHeaders() -> [String: String] {
        guard let cookie = sessionCookie ?? SessionStore.load() else { return [:] }
        return ["Cookie": cookie]
    }

    // MARK: - Profile update

    /// Updates the user's display name via POST /api/auth/update-user.
    /// Mirrors the Expo onboarding's updateProfile({ name }) call.
    func updateName(_ name: String) async throws {
        let url = AuthService.apiURL("/api/auth/update-user")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let cookie = sessionCookie { req.setValue(cookie, forHTTPHeaderField: "Cookie") }
        req.httpBody = try JSONEncoder().encode(["name": name])
        req.timeoutInterval = 12

        let (data, response) = try await URLSession.shared.data(for: req)

        guard let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode) else {
            let msg = AuthService.extractMessage(from: data) ?? "Failed to update profile."
            throw AuthError.serverError(msg)
        }

        // Update in-memory user with the new name
        if let user = currentUser {
            currentUser = AuthUser(id: user.id, email: user.email, name: name)
        }
    }

    // MARK: - Sign out

    func signOut() async {
        // Best-effort server-side sign-out; don't block local cleanup on failure
        let url = AuthService.apiURL("/api/auth/sign-out")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let cookie = sessionCookie {
            req.setValue(cookie, forHTTPHeaderField: "Cookie")
        }
        _ = try? await URLSession.shared.data(for: req)

        // Clear local state
        currentUser = nil
        sessionCookie = nil
        SessionStore.delete()
        clearCookies(for: AuthService.apiBaseURL)
    }

    // MARK: - Private cookie helpers

    private func extractCookieHeader(for url: URL) -> String? {
        guard let cookies = HTTPCookieStorage.shared.cookies(for: url),
              !cookies.isEmpty else { return nil }
        let headers = HTTPCookie.requestHeaderFields(with: cookies)
        return headers["Cookie"]
    }

    private func injectCookies(from cookieHeader: String, for url: URL) {
        let headers = ["Cookie": cookieHeader]
        let cookies = HTTPCookie.cookies(withResponseHeaderFields: ["Set-Cookie": cookieHeader], for: url)
        for cookie in cookies {
            HTTPCookieStorage.shared.setCookie(cookie)
        }
        // Fallback: let URLSession parse them from request header fields on next request
        _ = headers
    }

    private func clearCookies(for url: URL) {
        HTTPCookieStorage.shared.cookies(for: url)?.forEach {
            HTTPCookieStorage.shared.deleteCookie($0)
        }
    }
}
