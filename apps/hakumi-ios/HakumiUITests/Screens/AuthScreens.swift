import XCTest

// MARK: - SignInScreen
//
// Page object for AuthSignInScreen.
// Identifiers: auth.emailField, auth.continueButton

struct SignInScreen {
    let app: XCUIApplication

    var emailField: XCUIElement    { app.textFields["auth.emailField"] }
    var continueButton: XCUIElement { app.buttons["auth.continueButton"] }
    var passkeyButton: XCUIElement  { app.buttons["Use passkey"] }
    var errorText: XCUIElement      { app.staticTexts.element(matching:
        NSPredicate(format: "label CONTAINS[c] 'email'")) }

    var isVisible: Bool { continueButton.waitForExistence(timeout: 10) }

    func typeEmail(_ email: String) {
        emailField.tap()
        emailField.typeText(email)
    }

    func tapContinue() {
        continueButton.tap()
    }

    func fillAndSubmit(email: String) {
        typeEmail(email)
        tapContinue()
    }
}

// MARK: - VerifyOTPScreen

struct VerifyOTPScreen {
    let app: XCUIApplication

    var otpField: XCUIElement     { app.textFields["auth.otpField"] }
    var verifyButton: XCUIElement { app.buttons["auth.verifyButton"] }
    var resendButton: XCUIElement { app.buttons["Resend code"] }
    var changeEmailLink: XCUIElement { app.buttons["Use a different email"] }
    var errorText: XCUIElement { app.staticTexts.element(matching:
        NSPredicate(format: "label CONTAINS[c] 'problem'")) }

    var isVisible: Bool { otpField.waitForExistence(timeout: 15) }

    func typeOTP(_ code: String) {
        otpField.tap()
        otpField.typeText(code)
    }

    func tapVerify() {
        verifyButton.tap()
    }

    func fillAndSubmit(otp: String) {
        typeOTP(otp)
        tapVerify()
    }
}

// MARK: - OnboardingScreen

struct OnboardingScreen {
    let app: XCUIApplication

    var nameField: XCUIElement      { app.textFields["onboarding.nameField"] }
    var createButton: XCUIElement   { app.buttons["onboarding.createButton"] }
    var welcomeText: XCUIElement    { app.staticTexts["WELCOME"] }

    var isVisible: Bool { welcomeText.waitForExistence(timeout: 15) }

    func typeName(_ name: String) {
        nameField.tap()
        nameField.typeText(name)
    }

    func tapCreate() {
        createButton.tap()
    }

    func fillAndSubmit(name: String) {
        typeName(name)
        tapCreate()
    }
}
