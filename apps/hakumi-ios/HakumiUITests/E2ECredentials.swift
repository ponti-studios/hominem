import Foundation
import XCTest

// MARK: - E2ECredentials
//
// Test account constants for E2E flows.
//
// Persistent test account (sign-in tests):
//   - Must exist in the E2E backend before running sign-in tests.
//   - The backend accepts OTP "000000" for *@e2e.hakumi.io addresses
//     when running in E2E mode.
//
// Session injection (note flow tests):
//   - Obtain a valid session cookie by signing in once manually or via CI.
//   - Export it as E2E_SESSION_COOKIE in your shell, or set it as a CI secret.
//   - The E2E_USER_ID and E2E_USER_EMAIL values should match the signed-in user.

enum E2ECredentials {

    // MARK: - Existing test account (sign-in / sign-up flows)

    /// A pre-existing account in the E2E backend.
    static let existingEmail = "e2e@test.hakumi.io"

    /// A unique email for sign-up tests — creates a new account per run.
    static var newEmail: String {
        let ts = Int(Date().timeIntervalSince1970)
        return "e2e+\(ts)@test.hakumi.io"
    }

    /// The shared secret for accessing backend E2E test endpoints
    /// (x-e2e-auth-secret header). Must match AUTH_E2E_SECRET on the server.
    /// Override via E2E_SECRET environment variable.
    static let e2eSecret: String = ProcessInfo.processInfo.environment["E2E_SECRET"] ?? "otp-secret"

    // MARK: - Session injection (note / inbox flow tests)

    /// The signed-in user's ID. Must match the account for E2E_SESSION_COOKIE.
    /// Override by setting E2E_USER_ID in the process environment.
    static let userId: String = ProcessInfo.processInfo.environment["E2E_USER_ID"] ?? "e2e-user-id"

    /// Display name shown in the app for the test account.
    static let name = "E2E Test"

    // MARK: - Required values (throw when absent)

    /// Returns the session cookie from the process environment, or throws a
    /// skip if it is not set — so tests that need auth are skipped cleanly
    /// in environments where credentials haven't been configured.
    static func requiredSessionCookie(
        file: StaticString = #file,
        line: UInt = #line
    ) throws -> String {
        guard let cookie = ProcessInfo.processInfo.environment["E2E_SESSION_COOKIE"],
              !cookie.isEmpty else {
            throw XCTSkip(
                "E2E_SESSION_COOKIE is not set. " +
                "Export a valid session cookie to run authenticated flow tests. " +
                "See HakumiUITests/E2ECredentials.swift for instructions.",
                file: file,
                line: line
            )
        }
        return cookie
    }
}
