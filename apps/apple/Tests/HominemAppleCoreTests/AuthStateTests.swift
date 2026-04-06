import Testing
@testable import HominemAppleCore

@Test
func reducerLoadsSessionIntoSignedInState() {
    let user = AuthUser(id: "user-1", email: "user@example.com")
    let session = AuthSession(user: user, session: .init(id: "session-1", token: "token-1"))

    let next = reduceAuthState(AuthState(), .sessionLoaded(session))

    #expect(next.status == .signedIn)
    #expect(next.session == session)
    #expect(next.errorMessage == nil)
}

@Test
func reducerMovesToAwaitingOTPAfterSuccessfulRequest() {
    let pending = reduceAuthState(AuthState(), .emailOTPStarted("user@example.com"))
    let next = reduceAuthState(pending, .emailOTPSent)

    #expect(next.status == .awaitingOTP)
    #expect(next.pendingEmail == "user@example.com")
}

@Test
func reducerPreservesSignedInStateOnRecoverableFailure() {
    let session = AuthSession(
        user: .init(id: "user-1", email: "user@example.com"),
        session: .init(id: "session-1", token: "token-1")
    )
    let state = AuthState(status: .signedIn, session: session)
    let next = reduceAuthState(state, .failed("boom"))

    #expect(next.status == .signedIn)
    #expect(next.errorMessage == "boom")
}
