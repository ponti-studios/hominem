import Foundation

// MARK: - MockURLProtocol
//
// Intercepts all requests made through a URLSession whose configuration includes
// this protocol class. Tests supply a `handler` closure that receives the outbound
// URLRequest and returns an (HTTP status code, response body) pair.
//
// Usage:
//   let session = MockURLProtocol.makeSession { request in
//       return (200, myJSONData)
//   }
//   NoteService._testSession = session

final class MockURLProtocol: URLProtocol {

    // MARK: - Handler

    /// Set per-test to control what the mock session returns.
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (Int, Data))?

    // MARK: - Factory

    /// Creates a URLSession whose requests are intercepted by MockURLProtocol.
    static func makeSession(
        responding handler: @escaping (URLRequest) throws -> (Int, Data)
    ) -> URLSession {
        MockURLProtocol.handler = handler
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        return URLSession(configuration: config)
    }

    /// Creates a session that always returns `statusCode` with `body`.
    static func makeSession(statusCode: Int = 200, body: Data = Data()) -> URLSession {
        makeSession { _ in (statusCode, body) }
    }

    /// Creates a session that throws `error` for every request.
    static func makeSession(throwing error: Error) -> URLSession {
        makeSession { _ in throw error }
    }

    // MARK: - URLProtocol overrides

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = MockURLProtocol.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }
        do {
            let (statusCode, data) = try handler(request)
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: statusCode,
                httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "application/json"]
            )!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

// MARK: - JSON helpers

extension MockURLProtocol {
    /// Encodes a dictionary as JSON data — convenience for building mock bodies.
    static func json(_ value: Any) -> Data {
        (try? JSONSerialization.data(withJSONObject: value, options: [])) ?? Data()
    }

    /// Reads the request body from either `httpBody` or `httpBodyStream`.
    /// URLSession moves POST/PATCH body to `httpBodyStream` when routed through URLProtocol,
    /// so `httpBody` is nil inside `startLoading` for those requests.
    static func bodyData(from request: URLRequest) -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: buffer.count)
            guard read > 0 else { break }
            data.append(buffer, count: read)
        }
        return data.isEmpty ? nil : data
    }
}
