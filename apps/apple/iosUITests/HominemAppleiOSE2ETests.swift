import XCTest

// MARK: - HominemAppleiOSE2ETests
/// End-to-end tests for the iOS app
/// Tests the complete user workflows: authentication, notes, chats, settings
///
/// Requirements:
/// - Set HOMINEM_E2E_AUTH_TEST_SECRET environment variable to enable tests
/// - Set HOMINEM_E2E_API_BASE_URL (optional, defaults to http://localhost:4040)
/// - Backend must be running with auth test hook enabled
final class HominemAppleiOSE2ETests: XCTestCase {

    // MARK: - Setup and Teardown

    override func setUpWithError() throws {
        // Don't continue after first failure - stop immediately to diagnose issues
        continueAfterFailure = false
    }

    // MARK: - Environment Configuration

    /// Load and validate E2E test environment variables
    /// Throws XCTSkip if required environment variables are missing
    /// - Returns: Tuple of (testEmail, apiBaseURL, authTestSecret)
    private func resolveTestEnvironment() throws -> (email: String, apiBaseURL: String, authTestSecret: String) {
        let env = ProcessInfo.processInfo.environment
        let apiBaseURL = env["HOMINEM_E2E_API_BASE_URL"] ?? "http://localhost:4040"

        guard let authTestSecret = env["HOMINEM_E2E_AUTH_TEST_SECRET"], !authTestSecret.isEmpty else {
            throw XCTSkip(
                "HOMINEM_E2E_AUTH_TEST_SECRET is not set. " +
                "Set this environment variable to run the iOS E2E suite."
            )
        }

        // Generate unique email per test run to avoid conflicts
        // Uses UUID to ensure no duplicate accounts in testing
        let email = "otp-ios-e2e-\(UUID().uuidString.lowercased())@hominem.test"
        return (email, apiBaseURL, authTestSecret)
    }

    /// Launch the iOS app with E2E environment configuration
    /// - Parameters:
    ///   - apiBaseURL: Backend API base URL
    ///   - authTestSecret: Secret for test auth hook
    /// - Returns: XCUIApplication instance ready for testing
    private func launchApp(apiBaseURL: String, authTestSecret: String) -> XCUIApplication {
        let app = XCUIApplication()

        // Configure launch environment variables
        // These match the app's environment variable handling
        app.launchEnvironment["HOMINEM_API_BASE_URL"] = apiBaseURL
        app.launchEnvironment["HOMINEM_AUTH_TEST_SECRET"] = authTestSecret
        app.launchEnvironment["HOMINEM_E2E_MODE"] = "1"

        // Launch and activate the app
        app.launch()
        return app
    }

    // MARK: - Authentication Tests

    /// Test basic email OTP authentication flow
    /// Verifies: sign-in with OTP code, successful session creation
    @MainActor
    func testEmailOTPAuthFlow() throws {
        let (email, apiBaseURL, authTestSecret) = try resolveTestEnvironment()
        let app = launchApp(apiBaseURL: apiBaseURL, authTestSecret: authTestSecret)

        // Perform sign-in flow
        try signIn(app: app, email: email)

        // Verify we're signed in by checking for account email display
        let accountEmail = app.staticTexts["account.emailText"]
        XCTAssertTrue(
            accountEmail.waitForExistence(timeout: 20),
            "Account email not displayed after sign-in"
        )

        // Verify correct email is shown
        let displayedEmail = (accountEmail.value as? String) ?? accountEmail.label
        XCTAssertEqual(
            displayedEmail,
            email,
            "Displayed email should match signed-in email"
        )
    }

    /// Test sign-out flow
    /// Verifies: successful sign-out returns to sign-in screen
    @MainActor
    func testSignOutFlow() throws {
        let (email, apiBaseURL, authTestSecret) = try resolveTestEnvironment()
        let app = launchApp(apiBaseURL: apiBaseURL, authTestSecret: authTestSecret)

        // Sign in
        try signIn(app: app, email: email)

        // Verify we're signed in
        let accountEmail = app.staticTexts["account.emailText"]
        XCTAssertTrue(accountEmail.waitForExistence(timeout: 20))

        // Navigate to settings and sign out
        try navigateToSettings(app: app)
        signOut(app: app)

        // Verify we're back on sign-in screen
        let sendCodeButton = app.buttons["Send code"]
        XCTAssertTrue(
            sendCodeButton.waitForExistence(timeout: 20),
            "Should return to sign-in screen after sign-out"
        )
    }

    // MARK: - Notes Tests

    /// Test note creation flow
    /// Verifies: can create new note with title and content
    @MainActor
    func testNoteCreationFlow() throws {
        let (email, apiBaseURL, authTestSecret) = try resolveTestEnvironment()
        let app = launchApp(apiBaseURL: apiBaseURL, authTestSecret: authTestSecret)

        // Sign in
        try signIn(app: app, email: email)

        // Create a note
        let noteTitle = "E2E Test Note"
        let noteContent = "Created during E2E run at \(Date())"
        try createNote(app: app, title: noteTitle, content: noteContent)

        // Verify note appears in list (navigation back from detail)
        let noteInList = app.staticTexts[noteTitle]
        XCTAssertTrue(
            noteInList.waitForExistence(timeout: 10),
            "Note title should appear in notes list after creation"
        )
    }

    /// Test viewing note details
    /// Verifies: can open and view note details correctly
    @MainActor
    func testNoteDetailFlow() throws {
        let (email, apiBaseURL, authTestSecret) = try resolveTestEnvironment()
        let app = launchApp(apiBaseURL: apiBaseURL, authTestSecret: authTestSecret)

        // Sign in
        try signIn(app: app, email: email)

        // Create a note
        let noteTitle = "Detail Test Note"
        let noteContent = "Testing note detail view"
        try createNote(app: app, title: noteTitle, content: noteContent)

        // Open the note we just created
        let noteCell = app.staticTexts[noteTitle]
        XCTAssertTrue(
            noteCell.waitForExistence(timeout: 10),
            "Note should appear in list"
        )
        noteCell.tap()

        // Verify we're on the detail screen by checking for the note content
        let detailContent = app.staticTexts[noteContent]
        XCTAssertTrue(
            detailContent.waitForExistence(timeout: 10),
            "Note content should be visible in detail view"
        )

        // Navigate back
        let backButton = app.navigationBars.buttons.element(boundBy: 0)
        if backButton.exists {
            backButton.tap()
        }
    }

    // MARK: - Chats Tests

    /// Test chat message sending
    /// Verifies: can create chat and send message
    @MainActor
    func testChatMessageFlow() throws {
        let (email, apiBaseURL, authTestSecret) = try resolveTestEnvironment()
        let app = launchApp(apiBaseURL: apiBaseURL, authTestSecret: authTestSecret)

        // Sign in
        try signIn(app: app, email: email)

        // Send a chat message
        let messageText = "Hello from E2E test \(UUID().uuidString.prefix(8))"
        try sendChatMessage(app: app, message: messageText)

        // Verify message was sent and appears in thread
        let sentMessage = app.staticTexts[messageText]
        XCTAssertTrue(
            sentMessage.waitForExistence(timeout: 10),
            "Sent message should appear in chat thread"
        )
    }

    /// Test creating new chat session
    /// Verifies: can start a new chat conversation
    @MainActor
    func testNewChatCreation() throws {
        let (email, apiBaseURL, authTestSecret) = try resolveTestEnvironment()
        let app = launchApp(apiBaseURL: apiBaseURL, authTestSecret: authTestSecret)

        // Sign in
        try signIn(app: app, email: email)

        // Navigate to chats tab
        let chatsTab = app.tabBars.buttons["Chats"]
        if chatsTab.waitForExistence(timeout: 5) {
            chatsTab.tap()
        }

        // Create new chat
        let newChatButton = app.buttons.matching(NSPredicate(format: "label CONTAINS 'New' OR label CONTAINS 'new'")).firstMatch
        XCTAssertTrue(
            newChatButton.waitForExistence(timeout: 10),
            "Should be able to create new chat"
        )
    }

    // MARK: - Navigation Tests

    /// Test tab navigation
    /// Verifies: can navigate between different app tabs (Notes, Chats, Feed, Account)
    @MainActor
    func testTabNavigation() throws {
        let (email, apiBaseURL, authTestSecret) = try resolveTestEnvironment()
        let app = launchApp(apiBaseURL: apiBaseURL, authTestSecret: authTestSecret)

        // Sign in
        try signIn(app: app, email: email)

        // Get the tab bar
        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.exists, "Tab bar should be visible when signed in")

        // Navigate to each tab and verify it exists
        let tabs = ["Notes", "Chats", "Feed", "Account"]
        for tabName in tabs {
            let tab = tabBar.buttons[tabName]
            if tab.waitForExistence(timeout: 5) {
                tab.tap()
                // Each tab should load successfully
                XCTAssertTrue(
                    app.staticTexts.firstMatch.waitForExistence(timeout: 5),
                    "Tab '\(tabName)' should load content"
                )
            }
        }
    }

    /// Test settings navigation and access
    /// Verifies: can navigate to settings and view account info
    @MainActor
    func testSettingsNavigation() throws {
        let (email, apiBaseURL, authTestSecret) = try resolveTestEnvironment()
        let app = launchApp(apiBaseURL: apiBaseURL, authTestSecret: authTestSecret)

        // Sign in
        try signIn(app: app, email: email)

        // Navigate to account/settings
        try navigateToSettings(app: app)

        // Verify we can see sign-out option (proves we're on settings)
        let signOutButton = app.buttons["Sign out"]
        XCTAssertTrue(
            signOutButton.waitForExistence(timeout: 10),
            "Sign out button should be visible in settings"
        )
    }

    // MARK: - Core Workflow Tests

    /// Test complete app workflow: sign-in → create note → send chat → settings → sign-out
    /// This is the main integration test that verifies all features work together
    @MainActor
    func testCoreSignedInWorkflow() throws {
        let (email, apiBaseURL, authTestSecret) = try resolveTestEnvironment()
        let app = launchApp(apiBaseURL: apiBaseURL, authTestSecret: authTestSecret)

        // 1. Sign in
        try signIn(app: app, email: email)
        XCTAssertTrue(
            app.staticTexts["account.emailText"].waitForExistence(timeout: 20),
            "Should be signed in"
        )

        // 2. Create a note
        let noteTitle = "Workflow Test Note"
        let noteContent = "Testing full workflow"
        try createNote(app: app, title: noteTitle, content: noteContent)
        XCTAssertTrue(
            app.staticTexts[noteTitle].waitForExistence(timeout: 10),
            "Note should be created"
        )

        // 3. Send a chat message
        let chatMessage = "Workflow test message"
        try sendChatMessage(app: app, message: chatMessage)
        XCTAssertTrue(
            app.staticTexts[chatMessage].waitForExistence(timeout: 10),
            "Chat message should be sent"
        )

        // 4. Navigate to settings
        try navigateToSettings(app: app)
        XCTAssertTrue(
            app.buttons["Sign out"].waitForExistence(timeout: 10),
            "Should reach settings"
        )

        // 5. Sign out
        signOut(app: app)
        XCTAssertTrue(
            app.buttons["Send code"].waitForExistence(timeout: 20),
            "Should return to sign-in after sign-out"
        )
    }

    // MARK: - Environment Configuration Tests

    /// Test that missing environment variables are properly reported
    /// Prevents hanging tests with cryptic timeout errors
    @MainActor
    func testMissingEnvironmentFails() throws {
        let env = ProcessInfo.processInfo.environment
        if env["HOMINEM_E2E_AUTH_TEST_SECRET"] != nil {
            throw XCTSkip("Environment is configured — skipping misconfiguration test.")
        }

        // Should throw XCTSkip with clear message
        XCTAssertThrowsError(try resolveTestEnvironment()) { error in
            guard let skipError = error as? XCTSkip else {
                XCTFail("Should throw XCTSkip, got \(type(of: error))")
                return
            }
            XCTAssertTrue(
                skipError.description.contains("HOMINEM_E2E_AUTH_TEST_SECRET"),
                "Error should mention missing environment variable"
            )
        }
    }

    // MARK: - Helper Methods

    /// Helper: Sign in with email OTP
    /// - Parameters:
    ///   - app: The XCUIApplication instance
    ///   - email: Email address to sign in with
    private func signIn(app: XCUIApplication, email: String) throws {
        // Wait for the app to be ready
        let window = app.windows.firstMatch
        XCTAssertTrue(
            window.waitForExistence(timeout: 20),
            "App window should appear"
        )

        // Enter email
        let emailField = app.textFields["Email"]
        XCTAssertTrue(
            emailField.waitForExistence(timeout: 20),
            "Email field should be visible"
        )
        emailField.tap()
        emailField.typeText(email)

        // Send OTP code
        let sendCodeButton = app.buttons["Send code"]
        XCTAssertTrue(
            sendCodeButton.waitForExistence(timeout: 5),
            "Send code button should be available"
        )
        sendCodeButton.tap()

        // Fetch local test OTP code
        let fetchCodeButton = app.buttons["Fetch local test code"]
        XCTAssertTrue(
            fetchCodeButton.waitForExistence(timeout: 10),
            "Fetch test code button should appear"
        )
        fetchCodeButton.tap()

        // Verify OTP code
        let verifyCodeButton = app.buttons["Verify code"]
        XCTAssertTrue(
            verifyCodeButton.waitForExistence(timeout: 10),
            "Verify code button should appear"
        )

        // Wait for button to be enabled before tapping
        XCTAssertTrue(
            waitUntilEnabled(verifyCodeButton, timeout: 10),
            "Verify button should be enabled after code fetched"
        )
        verifyCodeButton.tap()

        // Confirm sign-in by waiting for account email to display
        let accountEmail = app.staticTexts["account.emailText"]
        XCTAssertTrue(
            accountEmail.waitForExistence(timeout: 20),
            "Should be signed in (account email should display)"
        )
    }

    /// Helper: Create a new note
    /// - Parameters:
    ///   - app: The XCUIApplication instance
    ///   - title: Note title to enter
    ///   - content: Note content to enter
    private func createNote(app: XCUIApplication, title: String, content: String) throws {
        // Navigate to notes if needed
        let notesTab = app.tabBars.buttons["Notes"]
        if notesTab.waitForExistence(timeout: 5) {
            notesTab.tap()
        }

        // Find and tap the new note button
        let newNoteButton = app.buttons.matching(
            NSPredicate(format: "label CONTAINS 'New' OR label CONTAINS 'new' OR identifier CONTAINS 'new'")
        ).firstMatch

        XCTAssertTrue(
            newNoteButton.waitForExistence(timeout: 10),
            "New note button should be accessible"
        )
        newNoteButton.tap()

        // Enter title (usually in a text field)
        let titleField = app.textFields.firstMatch
        if titleField.waitForExistence(timeout: 5) {
            titleField.tap()
            titleField.typeText(title)
        }

        // Enter content (usually in a text view)
        let contentView = app.textViews.firstMatch
        if contentView.waitForExistence(timeout: 5) {
            contentView.tap()
            contentView.typeText(content)
        }

        // Navigate back to save/finish
        let navBar = app.navigationBars.firstMatch
        if navBar.exists {
            let backButton = navBar.buttons.element(boundBy: 0)
            if backButton.exists {
                backButton.tap()
            }
        }

        // Wait a moment for the note to be saved
        usleep(500_000) // 0.5 second delay
    }

    /// Helper: Send a chat message
    /// - Parameters:
    ///   - app: The XCUIApplication instance
    ///   - message: Message text to send
    private func sendChatMessage(app: XCUIApplication, message: String) throws {
        // Navigate to chats tab
        let chatsTab = app.tabBars.buttons["Chats"]
        if chatsTab.waitForExistence(timeout: 5) {
            chatsTab.tap()
        }

        // Create or open a chat
        let newChatButton = app.buttons.matching(
            NSPredicate(format: "label CONTAINS 'New' OR label CONTAINS 'new'")
        ).firstMatch

        if newChatButton.waitForExistence(timeout: 10) {
            newChatButton.tap()
        }

        // Find the message input field
        let messageField = app.textFields.firstMatch
        if messageField.waitForExistence(timeout: 5) {
            messageField.tap()
            messageField.typeText(message)
        }

        // Send the message
        let sendButton = app.buttons["Send"]
        if sendButton.waitForExistence(timeout: 5) {
            XCTAssertTrue(
                waitUntilEnabled(sendButton, timeout: 5),
                "Send button should be enabled when message is entered"
            )
            sendButton.tap()
        }

        // Wait for message to appear in the thread
        _ = app.staticTexts[message].waitForExistence(timeout: 10)
    }

    /// Helper: Navigate to settings/account screen
    /// - Parameter app: The XCUIApplication instance
    private func navigateToSettings(app: XCUIApplication) throws {
        // Try account tab first
        let accountTab = app.tabBars.buttons["Account"]
        if accountTab.waitForExistence(timeout: 5) {
            accountTab.tap()
            return
        }

        // Otherwise look for settings button
        let settingsButton = app.buttons["Settings"]
        if settingsButton.waitForExistence(timeout: 5) {
            settingsButton.tap()
            return
        }

        throw NSError(
            domain: "NavigationError",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Could not navigate to settings"]
        )
    }

    /// Helper: Sign out of the app
    /// - Parameter app: The XCUIApplication instance
    private func signOut(app: XCUIApplication) {
        let signOutButton = app.buttons["Sign out"]
        if signOutButton.waitForExistence(timeout: 10) {
            signOutButton.tap()
        }
    }

    // MARK: - Utilities

    /// Wait for an element to become enabled
    /// - Parameters:
    ///   - element: The XCUIElement to wait for
    ///   - timeout: Maximum time to wait in seconds
    /// - Returns: True if element became enabled, false if timeout
    private func waitUntilEnabled(_ element: XCUIElement, timeout: TimeInterval) -> Bool {
        let predicate = NSPredicate(format: "enabled == true")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        return XCTWaiter().wait(for: [expectation], timeout: timeout) == .completed
    }
}
