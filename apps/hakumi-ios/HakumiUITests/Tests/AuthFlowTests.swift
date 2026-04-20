import XCTest

// MARK: - AuthFlowTests
//
// Tests the sign-in and sign-up flows end-to-end against the E2E backend.
//
// Prerequisites:
//   - App built with "Debug E2E" configuration (#if E2E enabled).
//   - Backend running at the URL in Debug E2E (ponti-macpro14.local:4040).
//   - AUTH_TEST_OTP_ENABLED=true and AUTH_E2E_SECRET set on the backend.
//   - Run `pnpm e2e:setup` in services/api to provision e2e@test.hakumi.io.

final class AuthFlowTests: HakumiUITestCase {

    // MARK: Sign-in

    func testSignInEmailScreenAppearsOnColdLaunch() {
        launchUnauthenticated(autoSubmitOTP: false) // no OTP injection — manual test mode
        let signIn = SignInScreen(app: app)
        XCTAssertTrue(signIn.isVisible, "Sign-in screen should be visible on cold launch")
    }

    func testSignInWithEmptyEmailShowsRequiredError() {
        launchUnauthenticated(autoSubmitOTP: false)
        let signIn = SignInScreen(app: app)
        XCTAssertTrue(signIn.isVisible)

        signIn.tapContinue() // tap without entering email

        waitForText(containing: "Email is required")
    }

    func testSignInWithInvalidEmailShowsValidationError() {
        launchUnauthenticated(autoSubmitOTP: false)
        let signIn = SignInScreen(app: app)
        XCTAssertTrue(signIn.isVisible)

        signIn.fillAndSubmit(email: "notanemail")

        waitForText(containing: "valid email")
    }

    func testSignInWithValidEmailNavigatesToOTPScreen() {
        launchUnauthenticated(autoSubmitOTP: false)
        let signIn = SignInScreen(app: app)
        XCTAssertTrue(signIn.isVisible)

        signIn.fillAndSubmit(email: E2ECredentials.existingEmail)

        let otp = VerifyOTPScreen(app: app)
        XCTAssertTrue(otp.isVisible, "OTP screen should appear after valid email submit")
    }

    func testSignInOTPScreenShowsEmailInHelper() {
        launchUnauthenticated(autoSubmitOTP: false)
        let signIn = SignInScreen(app: app)
        XCTAssertTrue(signIn.isVisible)

        signIn.fillAndSubmit(email: E2ECredentials.existingEmail)

        waitForText(containing: E2ECredentials.existingEmail)
    }

    /// Full sign-in flow: email → OTP (auto-filled via E2E_OTP) → inbox.
    func testFullSignInFlowLandsOnInbox() {
        launchUnauthenticated() // passes E2E_SECRET — VerifyOTPScreen fetches real OTP
        let signIn = SignInScreen(app: app)
        XCTAssertTrue(signIn.isVisible)

        signIn.fillAndSubmit(email: E2ECredentials.existingEmail)

        // VerifyOTPScreen auto-submits via E2E_OTP hook; expect inbox
        let inbox = InboxScreen(app: app)
        XCTAssertTrue(inbox.isVisible, "Inbox should appear after successful sign-in")
    }

    func testSignInWithWrongOTPShowsError() {
        launchUnauthenticated(autoSubmitOTP: false)
        let signIn = SignInScreen(app: app)
        XCTAssertTrue(signIn.isVisible)

        signIn.fillAndSubmit(email: E2ECredentials.existingEmail)

        let otp = VerifyOTPScreen(app: app)
        XCTAssertTrue(otp.isVisible)

        otp.fillAndSubmit(otp: "999999") // wrong OTP

        // Expect an error message on the OTP screen
        XCTAssertTrue(otp.isVisible, "Should remain on OTP screen after wrong code")
        waitForText(containing: "problem signing in")
    }

    func testChangeEmailLinkReturnsToSignInScreen() {
        launchUnauthenticated(autoSubmitOTP: false)
        let signIn = SignInScreen(app: app)
        XCTAssertTrue(signIn.isVisible)

        signIn.fillAndSubmit(email: E2ECredentials.existingEmail)

        let otp = VerifyOTPScreen(app: app)
        XCTAssertTrue(otp.isVisible)

        otp.changeEmailLink.tap()

        XCTAssertTrue(signIn.isVisible, "Should return to sign-in screen")
    }

    // MARK: Sign-up

    /// Full sign-up flow: new email → OTP (auto-filled) → onboarding → inbox.
    func testSignUpNewAccountFlowReachesOnboarding() {
        launchUnauthenticated() // injects testOTP = "000000"
        let signIn = SignInScreen(app: app)
        XCTAssertTrue(signIn.isVisible)

        signIn.fillAndSubmit(email: E2ECredentials.newEmail)

        // OTP screen appears — auto-submitted by E2E hook
        // New account → onboarding screen
        let onboarding = OnboardingScreen(app: app)
        XCTAssertTrue(onboarding.isVisible, "New account should be taken to onboarding")
    }

    func testSignUpCompleteProfileLandsOnInbox() {
        launchUnauthenticated()
        let signIn = SignInScreen(app: app)
        XCTAssertTrue(signIn.isVisible)

        signIn.fillAndSubmit(email: E2ECredentials.newEmail)

        let onboarding = OnboardingScreen(app: app)
        XCTAssertTrue(onboarding.isVisible)

        onboarding.fillAndSubmit(name: "E2E Test User")

        let inbox = InboxScreen(app: app)
        XCTAssertTrue(inbox.isVisible, "Inbox should appear after completing onboarding")
    }

    func testSignUpEmptyNameDisablesCreateButton() {
        launchUnauthenticated()
        let signIn = SignInScreen(app: app)
        XCTAssertTrue(signIn.isVisible)

        signIn.fillAndSubmit(email: E2ECredentials.newEmail)

        let onboarding = OnboardingScreen(app: app)
        XCTAssertTrue(onboarding.isVisible)

        // Don't type anything — Create profile should be disabled
        XCTAssertFalse(
            onboarding.createButton.isEnabled,
            "Create profile button should be disabled when name is empty"
        )
    }
}
