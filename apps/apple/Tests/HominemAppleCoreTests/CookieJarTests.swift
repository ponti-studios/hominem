import Foundation
import Testing
@testable import HominemAppleCore

@Test
func cookieJarBuildsHeaderValue() {
    let jar = CookieJar(
        cookies: [
            .init(name: "session_token", value: "abc"),
            .init(name: "better-auth-passkey", value: "def"),
        ]
    )

    #expect(jar.headerValue == "session_token=abc; better-auth-passkey=def")
}

@Test
func cookieJarCreatesHTTPCookiesForBaseURL() {
    let jar = CookieJar(
        cookies: [
            .init(name: "session_token", value: "abc"),
        ]
    )

    let cookies = jar.httpCookies(for: URL(string: "http://localhost:4040")!)

    #expect(cookies.count == 1)
    #expect(cookies.first?.name == "session_token")
    #expect(cookies.first?.value == "abc")
}
