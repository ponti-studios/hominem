import Foundation
import Testing
@testable import HominemAppleCore

@Suite(.serialized)
struct AuthServiceTests {
    @MainActor
    @Test
    func authServiceRetriesPasskeyDeleteWhenStepUpIsRequired() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [DeleteStepUpProtocol.self]
        let client = APIClient(
            baseURL: URL(string: "http://localhost:4040")!,
            sessionStore: DeleteStepUpStore(),
            configuration: configuration
        )
        let provider = StubPasskeyProvider()
        let service = AuthService(client: client, passkeyProvider: provider)

        DeleteStepUpProtocol.requests = []
        DeleteStepUpProtocol.responses = [
            .json(status: 403, body: #"{"error":"step_up_required"}"#),
            .json(status: 200, body: #"{"challenge":"YWJj","rpId":"api.ponti.io","allowCredentials":[],"userVerification":"preferred"}"#),
            .json(status: 200, body: #"{"session":{"id":"session-2","token":"token-2"}}"#),
            .json(status: 200, body: #"{"user":{"id":"user-1","email":"user@example.com"},"session":{"id":"session-2","token":"token-2"}}"#),
            .json(status: 200, body: #"{"success":true}"#),
            .json(status: 200, body: #"[{"id":"pk-1","name":"MacBook Passkey"}]"#),
        ]

        let passkeys = try await service.deletePasskey(id: "pk-1")

        #expect(provider.authenticateCalls == 1)
        #expect(passkeys.count == 1)
        #expect(passkeys.first?.id == "pk-1")
        #expect(DeleteStepUpProtocol.requests.map(\.path) == [
            "/api/auth/passkey/delete",
            "/api/auth/passkey/auth/options",
            "/api/auth/passkey/auth/verify",
            "/api/auth/session",
            "/api/auth/passkey/delete",
            "/api/auth/passkeys",
        ])
        #expect(DeleteStepUpProtocol.requests.map(\.method) == [
            "DELETE",
            "POST",
            "POST",
            "GET",
            "DELETE",
            "GET",
        ])
    }

    @MainActor
    @Test
    func authServiceNormalizesSessionRestoreFailures() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [DeleteStepUpProtocol.self]
        let client = APIClient(
            baseURL: URL(string: "http://localhost:4040")!,
            sessionStore: DeleteStepUpStore(),
            configuration: configuration
        )
        let service = AuthService(client: client, passkeyProvider: StubPasskeyProvider())

        DeleteStepUpProtocol.responses = [
            .json(status: 401, body: #"{"error":"unauthorized"}"#),
        ]

        let session = try await service.restoreSession()
        #expect(session == nil)
    }

    @MainActor
    @Test
    func authServiceFetchesLatestTestOTPForLocalE2E() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [TestOTPProtocol.self]
        let client = APIClient(
            baseURL: URL(string: "http://localhost:4040")!,
            sessionStore: DeleteStepUpStore(),
            configuration: configuration
        )
        let service = AuthService(client: client, passkeyProvider: StubPasskeyProvider())

        TestOTPProtocol.recordedRequest = nil

        let otp = try await service.fetchLatestTestOTP(
            email: "User@Example.com ",
            secret: " otp-secret "
        )

        #expect(otp == "123456")
        #expect(TestOTPProtocol.recordedRequest?.path == "/api/auth/test/otp/latest")
        #expect(TestOTPProtocol.recordedRequest?.query == "email=user@example.com&type=sign-in")
        #expect(TestOTPProtocol.recordedRequest?.secret == "otp-secret")
    }
}

private struct DeleteStepUpStore: SessionStore {
    func load() throws -> CookieJar { CookieJar() }
    func save(_ cookieJar: CookieJar) throws {}
    func clear() throws {}
}

@MainActor
private final class StubPasskeyProvider: PasskeyProviding {
    private(set) var authenticateCalls = 0

    func register(using options: PasskeyRegistrationOptions) async throws -> PasskeyRegistrationResponse {
        PasskeyRegistrationResponse(
            id: "reg-1",
            rawId: "reg-1",
            response: .init(clientDataJSON: "a", attestationObject: "b", transports: ["internal"]),
            type: "public-key",
            authenticatorAttachment: "platform",
            clientExtensionResults: [:]
        )
    }

    func authenticate(using options: PasskeyAuthenticationOptions) async throws -> PasskeyAuthenticationResponse {
        authenticateCalls += 1
        return PasskeyAuthenticationResponse(
            id: "auth-1",
            rawId: "auth-1",
            response: .init(clientDataJSON: "a", authenticatorData: "b", signature: "c", userHandle: nil),
            type: "public-key",
            authenticatorAttachment: "platform",
            clientExtensionResults: [:]
        )
    }
}

private final class DeleteStepUpProtocol: URLProtocol, @unchecked Sendable {
    enum Response {
        case json(status: Int, body: String)
    }

    struct RecordedRequest: Equatable {
        let method: String
        let path: String
    }

    nonisolated(unsafe) static var responses: [Response] = []
    nonisolated(unsafe) static var requests: [RecordedRequest] = []

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard DeleteStepUpProtocol.responses.isEmpty == false else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }

        DeleteStepUpProtocol.requests.append(
            .init(
                method: request.httpMethod ?? "GET",
                path: request.url?.path ?? ""
            )
        )

        let response = DeleteStepUpProtocol.responses.removeFirst()

        switch response {
        case .json(let status, let body):
            let httpResponse = HTTPURLResponse(
                url: request.url!,
                statusCode: status,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            client?.urlProtocol(self, didReceive: httpResponse, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        }
    }

    override func stopLoading() {}
}

private final class TestOTPProtocol: URLProtocol, @unchecked Sendable {
    struct RecordedRequest: Equatable {
        let path: String
        let query: String
        let secret: String?
    }

    nonisolated(unsafe) static var recordedRequest: RecordedRequest?

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        let url = request.url!
        TestOTPProtocol.recordedRequest = .init(
            path: url.path,
            query: url.query ?? "",
            secret: request.value(forHTTPHeaderField: "x-e2e-auth-secret")
        )

        let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(#"{"otp":"123456"}"#.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
