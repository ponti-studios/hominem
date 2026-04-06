import XCTest

final class HominemAppleMacE2ETests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testEmailOTPAuthFlow() throws {
        let app = XCUIApplication()
        let email = "otp-mac-e2e-\(UUID().uuidString.lowercased())@hominem.test"
        let environment = ProcessInfo.processInfo.environment
        let apiBaseURL = environment["HOMINEM_E2E_API_BASE_URL"] ?? "http://localhost:4040"
        let authTestSecret = environment["HOMINEM_E2E_AUTH_TEST_SECRET"] ?? "otp-secret"

        app.launchEnvironment["HOMINEM_API_BASE_URL"] = apiBaseURL
        app.launchEnvironment["HOMINEM_AUTH_TEST_SECRET"] = authTestSecret
        app.launchEnvironment["HOMINEM_E2E_MODE"] = "1"
        app.launch()
        app.activate()

        let window = app.windows.firstMatch
        XCTAssertTrue(window.waitForExistence(timeout: 20))

        let emailField = app.textFields["Email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 20))
        emailField.click()
        emailField.typeText(email)

        let sendCodeButton = app.buttons["Send code"]
        XCTAssertTrue(sendCodeButton.waitForExistence(timeout: 5))
        sendCodeButton.click()

        let fetchCodeButton = app.buttons["Fetch local test code"]
        XCTAssertTrue(fetchCodeButton.waitForExistence(timeout: 10))
        fetchCodeButton.click()

        let verifyCodeButton = app.buttons["Verify code"]
        XCTAssertTrue(verifyCodeButton.waitForExistence(timeout: 10))
        XCTAssertTrue(waitUntilEnabled(verifyCodeButton, timeout: 10))
        verifyCodeButton.click()

        let accountEmail = app.staticTexts["account.emailText"]
        XCTAssertTrue(accountEmail.waitForExistence(timeout: 20))
        let displayedEmail = (accountEmail.value as? String) ?? accountEmail.label
        XCTAssertEqual(displayedEmail, email)

        let signOutButton = app.buttons["Sign out"]
        XCTAssertTrue(signOutButton.waitForExistence(timeout: 5))
        signOutButton.click()

        XCTAssertTrue(sendCodeButton.waitForExistence(timeout: 20))
    }

    private func waitUntilEnabled(_ element: XCUIElement, timeout: TimeInterval) -> Bool {
        let predicate = NSPredicate(format: "enabled == true")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        return XCTWaiter().wait(for: [expectation], timeout: timeout) == .completed
    }
}
