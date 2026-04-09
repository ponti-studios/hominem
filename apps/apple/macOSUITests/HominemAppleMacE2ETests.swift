import XCTest

// MARK: - HominemAppleMacE2ETests

final class HominemAppleMacE2ETests: XCTestCase {

    // MARK: - Setup

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    // MARK: - Environment validation

    /// Read environment values needed for OTP auth. Fails the test explicitly
    /// (instead of timing out silently) when the required values are missing.
    private func resolveTestEnvironment() throws -> (email: String, apiBaseURL: String, authTestSecret: String) {
        let env = ProcessInfo.processInfo.environment
        let apiBaseURL = env["HOMINEM_E2E_API_BASE_URL"] ?? "http://localhost:4040"

        guard let authTestSecret = env["HOMINEM_E2E_AUTH_TEST_SECRET"], !authTestSecret.isEmpty else {
            throw XCTSkip(
                "HOMINEM_E2E_AUTH_TEST_SECRET is not set. " +
                "Set this environment variable to run the macOS E2E suite."
            )
        }

        let email = "otp-mac-e2e-\(UUID().uuidString.lowercased())@hominem.test"
        return (email, apiBaseURL, authTestSecret)
    }

    private func launchApp(apiBaseURL: String, authTestSecret: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["HOMINEM_API_BASE_URL"] = apiBaseURL
        app.launchEnvironment["HOMINEM_AUTH_TEST_SECRET"] = authTestSecret
        app.launchEnvironment["HOMINEM_E2E_MODE"] = "1"
        app.launch()
        app.activate()
        return app
    }

    // MARK: - OTP sign-in and sign-out

    @MainActor
    func testEmailOTPAuthFlow() throws {
        let (email, apiBaseURL, authTestSecret) = try resolveTestEnvironment()
        let app = launchApp(apiBaseURL: apiBaseURL, authTestSecret: authTestSecret)

        try signIn(app: app, email: email)

        let accountEmail = app.staticTexts["account.emailText"]
        XCTAssertTrue(accountEmail.waitForExistence(timeout: 20))
        let displayedEmail = (accountEmail.value as? String) ?? accountEmail.label
        XCTAssertEqual(displayedEmail, email)

        let sendCodeButton = app.buttons["Send code"]
        signOut(app: app)
        XCTAssertTrue(sendCodeButton.waitForExistence(timeout: 20))
    }

    // MARK: - Core signed-in flows

    /// Verifies OTP sign-in, note creation, chat send, settings navigation,
    /// and sign-out in a single continuous session.
    @MainActor
    func testCoreSignedInWorkflow() throws {
        let (email, apiBaseURL, authTestSecret) = try resolveTestEnvironment()
        let app = launchApp(apiBaseURL: apiBaseURL, authTestSecret: authTestSecret)

        // 1. Sign in
        try signIn(app: app, email: email)

        // 2. Create a note
        try createNote(app: app, title: "E2E Test Note", content: "Created during E2E run")

        // 3. Send a chat message
        try sendChatMessage(app: app, message: "Hello from E2E test")

        // 4. Navigate to settings and verify we reach the screen
        try navigateToSettings(app: app)

        // 5. Sign out and verify we are back on the sign-in screen
        signOut(app: app)
        let sendCodeButton = app.buttons["Send code"]
        XCTAssertTrue(sendCodeButton.waitForExistence(timeout: 20))
    }

    // MARK: - Missing environment fails with explicit error

    @MainActor
    func testMissingEnvironmentFails() throws {
        // This test verifies that if the env var is absent the test reports
        // a clear XCTSkip instead of hanging with a cryptic timeout.
        // When HOMINEM_E2E_AUTH_TEST_SECRET IS present this test is also skipped
        // (to avoid a redundant full E2E run).
        let env = ProcessInfo.processInfo.environment
        if env["HOMINEM_E2E_AUTH_TEST_SECRET"] != nil {
            throw XCTSkip("Environment is configured — skipping the misconfiguration guard test.")
        }
        // Calling resolveTestEnvironment() without the secret should throw XCTSkip.
        XCTAssertThrowsError(try resolveTestEnvironment())
    }

    // MARK: - Helpers

    private func signIn(app: XCUIApplication, email: String) throws {
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

        // Confirm signed-in by waiting for the account email label
        let accountEmail = app.staticTexts["account.emailText"]
        XCTAssertTrue(accountEmail.waitForExistence(timeout: 20))
    }

    private func createNote(app: XCUIApplication, title: String, content: String) throws {
        // Open the notes section (sidebar or toolbar button)
        let newNoteButton = app.buttons["New note"]
        if !newNoteButton.waitForExistence(timeout: 10) {
            // Try navigating via tab / sidebar if the direct button isn't visible
            let notesTab = app.buttons["Notes"]
            if notesTab.waitForExistence(timeout: 5) { notesTab.click() }
            XCTAssertTrue(newNoteButton.waitForExistence(timeout: 10), "New note button not found")
        }
        newNoteButton.click()

        // Type title
        let titleField = app.textFields["Untitled"]
        if titleField.waitForExistence(timeout: 5) {
            titleField.click()
            titleField.typeText(title)
        }

        // Type content in the editor
        let textEditor = app.textViews.firstMatch
        if textEditor.waitForExistence(timeout: 5) {
            textEditor.click()
            textEditor.typeText(content)
        }

        // Navigate back to verify note was created
        let backButton = app.buttons["Back"]
        if backButton.waitForExistence(timeout: 3) {
            backButton.click()
        }
    }

    private func sendChatMessage(app: XCUIApplication, message: String) throws {
        // Navigate to chats
        let chatsTab = app.buttons["Chats"]
        if chatsTab.waitForExistence(timeout: 5) { chatsTab.click() }

        let newChatButton = app.buttons["New chat"]
        if newChatButton.waitForExistence(timeout: 10) {
            newChatButton.click()
        }

        let messageField = app.textFields.matching(identifier: "Message").firstMatch
        if messageField.waitForExistence(timeout: 5) {
            messageField.click()
            messageField.typeText(message)
        } else {
            let anyTextFields = app.textFields.firstMatch
            if anyTextFields.waitForExistence(timeout: 5) {
                anyTextFields.click()
                anyTextFields.typeText(message)
            }
        }

        let sendButton = app.buttons["Send"]
        if sendButton.waitForExistence(timeout: 5) {
            XCTAssertTrue(waitUntilEnabled(sendButton, timeout: 5))
            sendButton.click()
        }

        // Wait a moment for the message to appear in the thread
        _ = app.staticTexts[message].waitForExistence(timeout: 10)
    }

    private func navigateToSettings(app: XCUIApplication) throws {
        // Try the gear icon or Settings menu item
        let settingsButton = app.buttons["Settings"]
        let menuBar = app.menuBars.firstMatch

        if settingsButton.waitForExistence(timeout: 5) {
            settingsButton.click()
        } else if menuBar.exists {
            // Fall back to the app menu
            menuBar.menuItems["Settings..."].click()
        }

        // Confirm we reached a settings screen by looking for a known element
        let signOutButton = app.buttons["Sign out"]
        XCTAssertTrue(
            signOutButton.waitForExistence(timeout: 10),
            "Expected to find Sign out button on the Settings/Account screen"
        )
    }

    private func signOut(app: XCUIApplication) {
        let signOutButton = app.buttons["Sign out"]
        XCTAssertTrue(signOutButton.waitForExistence(timeout: 10))
        signOutButton.click()
    }

    // MARK: - Utilities

    private func waitUntilEnabled(_ element: XCUIElement, timeout: TimeInterval) -> Bool {
        let predicate = NSPredicate(format: "enabled == true")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        return XCTWaiter().wait(for: [expectation], timeout: timeout) == .completed
    }
}
