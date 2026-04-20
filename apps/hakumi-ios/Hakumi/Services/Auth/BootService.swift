import Foundation

// MARK: - BootService
// Implements the cold-launch session probe that determines whether a returning
// user has a valid session. Mirrors boot.ts / boot-session-probe.ts logic.

enum BootService {

    // MARK: - Boot result

    enum BootResult {
        case sessionLoaded(user: AuthUser, cookie: String)
        case sessionExpired
    }

    // MARK: - Run boot

    /// Top-level boot sequence:
    /// 1. Read cookie from Keychain
    /// 2. Probe /api/auth/session — if valid, restore; if expired, clear
    /// 3. Return the outcome for Router to act on
    static func run() async -> BootResult {
        #if E2E
        if let result = e2eInjectedSession() { return result }
        #endif

        guard let cookie = SessionStore.load(), !cookie.isEmpty else {
            return .sessionExpired
        }

        do {
            if let user = try await probeSession(cookie: cookie) {
                return .sessionLoaded(user: user, cookie: cookie)
            } else {
                SessionStore.delete()
                return .sessionExpired
            }
        } catch {
            // Network failure during boot — treat as signed-out rather than crashing.
            // The user can sign in manually; a failed probe should not block launch.
            return .sessionExpired
        }
    }

    // MARK: - E2E session injection
    //
    // When the app is launched by XCUITest with E2E_SESSION_COOKIE set in
    // launchEnvironment, skip the normal Keychain/probe sequence entirely and
    // restore the injected session. Only compiled into Debug E2E builds.

    #if E2E
    private static func e2eInjectedSession() -> BootResult? {
        let env = ProcessInfo.processInfo.environment
        guard let cookie = env["E2E_SESSION_COOKIE"], !cookie.isEmpty,
              let userId = env["E2E_USER_ID"],
              let email = env["E2E_USER_EMAIL"] else { return nil }
        let user = AuthUser(id: userId, email: email, name: env["E2E_USER_NAME"])
        return .sessionLoaded(user: user, cookie: cookie)
    }
    #endif

    // MARK: - Session probe

    /// GET /api/auth/session — mirrors probeAuthSession() in boot-session-probe.ts
    static func probeSession(cookie: String) async throws -> AuthUser? {
        let url = AuthService.apiURL("/api/auth/session")
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue(cookie, forHTTPHeaderField: "Cookie")
        req.timeoutInterval = 8

        let (data, response) = try await URLSession.shared.data(for: req)

        guard let http = response as? HTTPURLResponse else {
            throw AuthError.networkError
        }

        // 401 = session expired/invalid — not an error, just expired
        if http.statusCode == 401 { return nil }

        guard (200..<300).contains(http.statusCode) else {
            let msg = AuthService.extractMessage(from: data) ?? "Session probe failed."
            throw AuthError.serverError(msg)
        }

        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let userData = json["user"] as? [String: Any],
            let id = userData["id"] as? String,
            let email = userData["email"] as? String,
            !id.isEmpty, !email.isEmpty
        else {
            return nil
        }

        return AuthUser(id: id, email: email, name: userData["name"] as? String)
    }
}
