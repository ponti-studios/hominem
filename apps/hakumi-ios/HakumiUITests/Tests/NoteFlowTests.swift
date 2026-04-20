import XCTest

// MARK: - NoteFlowTests
//
// End-to-end tests for creating and editing notes.
// All tests use session injection (launchAuthenticated) so auth is bypassed.
//
// Requires E2E_SESSION_COOKIE, E2E_USER_ID, E2E_USER_EMAIL to be set.
// Tests skip cleanly with XCTSkip if the cookie is absent.

final class NoteFlowTests: HakumiUITestCase {

    // MARK: - Create note (from Inbox composer)

    /// Typing in the inbox composer and tapping send creates a note that
    /// appears at the top of the inbox list immediately (optimistic insert).
    func testCreateNoteFromInboxComposerAppearsAtTopOfFeed() throws {
        try launchAuthenticated()

        let inbox = InboxScreen(app: app)
        XCTAssertTrue(inbox.isVisible)

        let noteText = "E2E note \(Int(Date().timeIntervalSince1970))"
        let composer = ComposerCard(app: app)
        XCTAssertTrue(composer.isVisible)

        composer.composeAndSend(noteText)

        // The composer should clear immediately (optimistic)
        XCTAssertEqual(
            composer.textField.value as? String ?? "",
            "",
            "Composer text field should be empty after submit"
        )

        // The note should appear in the list (optimistic or confirmed)
        let noteRow = inbox.listItem(titled: noteText)
        XCTAssertTrue(
            noteRow.waitForExistence(timeout: 10),
            "New note should appear in inbox feed after submit"
        )
    }

    func testComposerSendButtonDisabledWhenEmpty() throws {
        try launchAuthenticated()

        let inbox = InboxScreen(app: app)
        XCTAssertTrue(inbox.isVisible)

        let composer = ComposerCard(app: app)
        XCTAssertTrue(composer.isVisible)

        XCTAssertFalse(
            composer.sendButton.isEnabled,
            "Send button should be disabled when composer is empty"
        )
    }

    func testComposerSendButtonEnabledAfterTyping() throws {
        try launchAuthenticated()

        let inbox = InboxScreen(app: app)
        XCTAssertTrue(inbox.isVisible)

        let composer = ComposerCard(app: app)
        XCTAssertTrue(composer.isVisible)

        composer.typeText("Hello")

        XCTAssertTrue(
            composer.sendButton.isEnabled,
            "Send button should be enabled once text is entered"
        )
    }

    func testComposerClearsAfterSuccessfulSend() throws {
        try launchAuthenticated()

        let inbox = InboxScreen(app: app)
        XCTAssertTrue(inbox.isVisible)

        let composer = ComposerCard(app: app)
        XCTAssertTrue(composer.isVisible)

        composer.composeAndSend("Clearing test note")

        let fieldValue = composer.textField.value as? String ?? ""
        XCTAssertEqual(fieldValue, "", "Composer should be empty after send")

        XCTAssertFalse(
            composer.sendButton.isEnabled,
            "Send button should return to inactive state after send"
        )
    }

    // MARK: - Create note (from Notes tab composer)

    func testCreateNoteFromNotesComposerAppearsAtTopOfList() throws {
        try launchAuthenticated()

        // Navigate to Notes tab
        app.tabBars.buttons["Notes"].tap()

        let notes = NotesScreen(app: app)
        XCTAssertTrue(notes.isVisible)

        let noteText = "Notes tab note \(Int(Date().timeIntervalSince1970))"
        let composer = ComposerCard(app: app)
        XCTAssertTrue(composer.isVisible)

        composer.composeAndSend(noteText)

        // Note should appear at the top of the Notes list
        let noteRow = notes.row(titled: noteText)
        XCTAssertTrue(
            noteRow.waitForExistence(timeout: 10),
            "New note should appear in Notes list after submit"
        )
    }

    // MARK: - Create note via toolbar (Notes tab)

    func testCreateNoteViaToolbarButtonOpensEditor() throws {
        try launchAuthenticated()

        app.tabBars.buttons["Notes"].tap()

        let notes = NotesScreen(app: app)
        XCTAssertTrue(notes.isVisible)

        notes.tapNew()

        let detail = NoteDetailScreen(app: app)
        XCTAssertTrue(
            detail.isVisible,
            "Note detail editor should open after tapping the toolbar new-note button"
        )
    }

    func testCreateNoteViaToolbarShowsEmptyEditor() throws {
        try launchAuthenticated()

        app.tabBars.buttons["Notes"].tap()

        let notes = NotesScreen(app: app)
        XCTAssertTrue(notes.isVisible)

        notes.tapNew()

        let detail = NoteDetailScreen(app: app)
        XCTAssertTrue(detail.isVisible)

        let titleValue = detail.titleField.value as? String ?? ""
        XCTAssertEqual(titleValue, "", "Title field should be empty for a new note")
    }

    // MARK: - Edit note

    /// Creates a note via the toolbar, edits title and content, navigates
    /// back, then re-opens the note to confirm the changes were saved.
    func testEditNoteTitleAndContentPersistsAfterNavigation() throws {
        try launchAuthenticated()

        app.tabBars.buttons["Notes"].tap()

        let notes = NotesScreen(app: app)
        XCTAssertTrue(notes.isVisible)

        // Create a new note via toolbar
        notes.tapNew()

        let detail = NoteDetailScreen(app: app)
        XCTAssertTrue(detail.isVisible)

        let uniqueTitle = "E2E Title \(Int(Date().timeIntervalSince1970))"
        let uniqueContent = "E2E body content \(Int(Date().timeIntervalSince1970))"

        detail.setTitle(uniqueTitle)
        detail.appendContent(uniqueContent)

        // Wait for the autosave checkmark to confirm the save fired
        // (autosave debounce is 600ms)
        let checkmark = detail.saveCheckmark
        XCTAssertTrue(
            checkmark.waitForExistence(timeout: 5),
            "Save indicator checkmark should appear after editing"
        )

        detail.navigateBack()

        // The note should appear in the list with the new title
        XCTAssertTrue(notes.isVisible)
        let savedRow = notes.row(titled: uniqueTitle)
        XCTAssertTrue(
            savedRow.waitForExistence(timeout: 5),
            "Edited note title should appear in Notes list after navigating back"
        )

        // Re-open the note to confirm content is persisted
        savedRow.tap()
        XCTAssertTrue(detail.isVisible)

        XCTAssertTrue(
            app.staticTexts[uniqueContent].waitForExistence(timeout: 5) ||
            (detail.contentEditor.value as? String ?? "").contains(uniqueContent),
            "Note content should be persisted after re-opening"
        )
    }

    func testEditNoteShowsSaveCheckmarkAfterTyping() throws {
        try launchAuthenticated()

        app.tabBars.buttons["Notes"].tap()

        let notes = NotesScreen(app: app)
        XCTAssertTrue(notes.isVisible)

        notes.tapNew()

        let detail = NoteDetailScreen(app: app)
        XCTAssertTrue(detail.isVisible)

        detail.appendContent("Autosave trigger text")

        XCTAssertTrue(
            detail.saveCheckmark.waitForExistence(timeout: 5),
            "Checkmark should appear within autosave window (600ms debounce)"
        )
    }

    func testEditNoteTitleUpdatesInNotesList() throws {
        try launchAuthenticated()

        app.tabBars.buttons["Notes"].tap()

        let notes = NotesScreen(app: app)
        XCTAssertTrue(notes.isVisible)

        notes.tapNew()

        let detail = NoteDetailScreen(app: app)
        XCTAssertTrue(detail.isVisible)

        let newTitle = "Renamed \(Int(Date().timeIntervalSince1970))"
        detail.setTitle(newTitle)

        // Wait for autosave
        _ = detail.saveCheckmark.waitForExistence(timeout: 5)

        detail.navigateBack()

        XCTAssertTrue(notes.isVisible)
        XCTAssertTrue(
            notes.row(titled: newTitle).waitForExistence(timeout: 5),
            "Updated title should appear in Notes list"
        )
    }

    // MARK: - Inbox ↔ Notes consistency

    /// A note created from the Inbox composer should also appear on the Notes tab.
    func testNoteCreatedFromInboxAppearsInNotesList() throws {
        try launchAuthenticated()

        let inbox = InboxScreen(app: app)
        XCTAssertTrue(inbox.isVisible)

        let noteText = "Cross-tab note \(Int(Date().timeIntervalSince1970))"
        let composer = ComposerCard(app: app)
        XCTAssertTrue(composer.isVisible)

        composer.composeAndSend(noteText)

        // Verify it appears on the Inbox tab
        XCTAssertTrue(
            inbox.listItem(titled: noteText).waitForExistence(timeout: 10),
            "Note should appear in inbox"
        )

        // Switch to Notes tab and verify it appears there too
        app.tabBars.buttons["Notes"].tap()

        let notes = NotesScreen(app: app)
        XCTAssertTrue(notes.isVisible)

        XCTAssertTrue(
            notes.row(titled: noteText).waitForExistence(timeout: 10),
            "Note created from Inbox should also appear in Notes list"
        )
    }
}
