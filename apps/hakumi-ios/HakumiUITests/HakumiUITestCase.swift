import XCTest

// MARK: - HakumiUITestCase
//
// Base class for all Hakumi UI tests. Provides two launch modes:
//
// 1. launchAuthenticated() — injects a pre-baked session via launchEnvironment
//    so tests skip the auth flow entirely. Requires E2E_SESSION_COOKIE,
//    E2E_USER_ID, and E2E_USER_EMAIL to be set in the process environment
//    (or CI secrets). Use this for all note/inbox flow tests.
//
// 2. launchUnauthenticated(testOTP:) — launches with no stored session.
//    If testOTP is provided, the app auto-fills and submits the OTP screen.
//    Use this for sign-in/sign-up flow tests.
//
// Backend requirements for E2E mode:
//   - OTP "000000" is always accepted for addresses matching *@e2e.hakumi.io
//     when the server receives the X-E2E-Test: 1 header (set automatically
//     in Debug E2E builds, or configure the backend's E2E_TEST_MODE env var).
//   - A persistent test account (E2ECredentials.existingEmail) must exist.

class HakumiUITestCase: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        try super.setUpWithError()
        continueAfterFailure = false
        app = XCUIApplication()
    }

    override func tearDownWithError() throws {
        app = nil
        try super.tearDownWithError()
    }

    // MARK: - Launch helpers

    /// Launch already authenticated by injecting a real session cookie.
    /// The app's BootService reads E2E_SESSION_COOKIE and bypasses the normal
    /// Keychain/probe sequence (#if E2E guard in BootService.swift).
    ///
    /// In CI, set E2E_SESSION_COOKIE / E2E_USER_ID / E2E_USER_EMAIL as secrets.
    /// Locally, export them in your shell before running tests:
    ///   export E2E_SESSION_COOKIE="hakumi.session=..."
    func launchAuthenticated() throws {
        let cookie = try E2ECredentials.requiredSessionCookie()
        app.launchEnvironment["E2E_SESSION_COOKIE"] = cookie
        app.launchEnvironment["E2E_USER_ID"] = E2ECredentials.userId
        app.launchEnvironment["E2E_USER_EMAIL"] = E2ECredentials.existingEmail
        app.launchEnvironment["E2E_USER_NAME"] = E2ECredentials.name
        app.launch()
    }

    /// Launch unauthenticated. If testOTP is provided it is injected as
    /// E2E_OTP so VerifyOTPScreen auto-submits on appearance.
    func launchUnauthenticated(testOTP: String? = E2ECredentials.testOTP) {
        if let otp = testOTP {
            app.launchEnvironment["E2E_OTP"] = otp
        }
        app.launch()
    }

    // MARK: - Wait helpers

    @discardableResult
    func waitFor(
        _ element: XCUIElement,
        timeout: TimeInterval = 15,
        file: StaticString = #file,
        line: UInt = #line
    ) -> XCUIElement {
        let exists = element.waitForExistence(timeout: timeout)
        XCTAssertTrue(exists, "Expected element to exist: \(element)", file: file, line: line)
        return element
    }

    func waitForAbsence(
        _ element: XCUIElement,
        timeout: TimeInterval = 10,
        file: StaticString = #file,
        line: UInt = #line
    ) {
        let predicate = NSPredicate(format: "exists == false")
        let expectation = expectation(for: predicate, evaluatedWith: element)
        let result = XCTWaiter.wait(for: [expectation], timeout: timeout)
        XCTAssertEqual(result, .completed, "Expected element to disappear: \(element)", file: file, line: line)
    }

    /// Wait until a StaticText containing the substring appears anywhere on screen.
    @discardableResult
    func waitForText(
        containing substring: String,
        timeout: TimeInterval = 15,
        file: StaticString = #file,
        line: UInt = #line
    ) -> XCUIElement {
        let predicate = NSPredicate(format: "label CONTAINS[c] %@", substring)
        let element = app.staticTexts.element(matching: predicate)
        let exists = element.waitForExistence(timeout: timeout)
        XCTAssertTrue(exists, "Expected text containing '\(substring)'", file: file, line: line)
        return element
    }
}
