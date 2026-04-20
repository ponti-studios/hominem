import XCTest

// MARK: - InboxScreen

struct InboxScreen {
    let app: XCUIApplication

    var navigationTitle: XCUIElement { app.navigationBars["Inbox"] }
    var isVisible: Bool { navigationTitle.waitForExistence(timeout: 15) }

    /// Returns the first row whose title label contains the given text.
    func row(containing text: String) -> XCUIElement {
        app.cells.containing(.staticText, identifier: text).firstMatch
    }

    /// Returns a static text element anywhere in the list matching the string.
    func listItem(titled text: String) -> XCUIElement {
        app.staticTexts[text]
    }
}

// MARK: - NotesScreen

struct NotesScreen {
    let app: XCUIApplication

    var navigationTitle: XCUIElement { app.navigationBars["Notes"] }
    var newButton: XCUIElement       { app.buttons["notes.newButton"] }
    var isVisible: Bool              { navigationTitle.waitForExistence(timeout: 15) }

    /// Finds a note row by its displayed title.
    func row(titled text: String) -> XCUIElement {
        app.staticTexts[text]
    }

    func tapNew() {
        newButton.tap()
    }
}

// MARK: - ComposerCard

struct ComposerCard {
    let app: XCUIApplication

    var textField: XCUIElement  { app.textFields["composer.textField"] }
    var sendButton: XCUIElement { app.buttons["composer.sendButton"] }

    var isVisible: Bool { textField.waitForExistence(timeout: 10) }

    func typeText(_ text: String) {
        textField.tap()
        textField.typeText(text)
    }

    func tapSend() {
        sendButton.tap()
    }

    func composeAndSend(_ text: String) {
        typeText(text)
        tapSend()
    }
}

// MARK: - NoteDetailScreen

struct NoteDetailScreen {
    let app: XCUIApplication

    var titleField: XCUIElement   { app.textFields["note.titleField"] }
    var contentEditor: XCUIElement { app.textViews["note.contentEditor"] }

    /// Matches the save checkmark that briefly appears after autosave.
    var saveCheckmark: XCUIElement { app.images["checkmark"] }

    var isVisible: Bool { titleField.waitForExistence(timeout: 15) }

    func setTitle(_ text: String) {
        titleField.tap()
        // Clear existing text first
        titleField.press(forDuration: 1)
        if app.menuItems["Select All"].waitForExistence(timeout: 2) {
            app.menuItems["Select All"].tap()
            titleField.typeText(text)
        } else {
            titleField.typeText(text)
        }
    }

    func appendContent(_ text: String) {
        contentEditor.tap()
        contentEditor.typeText(text)
    }

    func clearAndSetContent(_ text: String) {
        contentEditor.tap()
        contentEditor.press(forDuration: 1)
        if app.menuItems["Select All"].waitForExistence(timeout: 2) {
            app.menuItems["Select All"].tap()
            contentEditor.typeText(text)
        } else {
            contentEditor.typeText(text)
        }
    }

    func navigateBack() {
        app.navigationBars.buttons.firstMatch.tap()
    }
}
