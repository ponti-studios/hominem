import Foundation
import Testing
@testable import HominemAppleCore

@Suite(.serialized)
struct APIClientTests {
    @Test
    func apiClientPersistsCookiesAndSendsCookieHeader() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        let sessionStore = InMemorySessionStore()
        let client = APIClient(
            baseURL: URL(string: "http://localhost:4040")!,
            sessionStore: sessionStore,
            configuration: configuration
        )

        InMemorySessionStore.cookieJar = CookieJar()

        MockURLProtocol.handler = { request in
            if request.url?.path == "/api/auth/email-otp/verify" {
                let response = HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: [
                        "Content-Type": "application/json",
                        "Set-Cookie": "session_token=abc123; Path=/; HttpOnly",
                    ]
                )!
                let data = #"{"token":"token-1","user":{"id":"user-1","email":"user@example.com"}}"#.data(using: .utf8)!
                return (response, data)
            }

            #expect(request.value(forHTTPHeaderField: "Cookie") == "session_token=abc123")

            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            let data = #"{"user":{"id":"user-1","email":"user@example.com"},"session":{"id":"session-1","token":"token-1"}}"#.data(using: .utf8)!
            return (response, data)
        }

        struct VerifyBody: Encodable {
            let email: String
            let otp: String
        }

        _ = try await client.post(
            EmailOTPSignInEnvelope.self,
            path: "/api/auth/email-otp/verify",
            body: VerifyBody(email: "user@example.com", otp: "123456")
        )

        let session = try await client.get(AuthSession?.self, path: "/api/auth/session")
        #expect(session?.user.email == "user@example.com")
        #expect(try sessionStore.load().headerValue == "session_token=abc123")
    }
}

private struct InMemorySessionStore: SessionStore {
    nonisolated(unsafe) static var cookieJar = CookieJar()

    func load() throws -> CookieJar {
        Self.cookieJar
    }

    func save(_ cookieJar: CookieJar) throws {
        Self.cookieJar = cookieJar
    }

    func clear() throws {
        Self.cookieJar = CookieJar()
    }
}

private final class MockURLProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: (@Sendable (URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
