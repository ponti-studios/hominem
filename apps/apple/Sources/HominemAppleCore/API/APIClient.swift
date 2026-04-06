import Foundation

public struct APIResponse: Sendable {
    public let statusCode: Int
    public let data: Data

    public init(statusCode: Int, data: Data) {
        self.statusCode = statusCode
        self.data = data
    }
}

public enum APIClientError: Error, LocalizedError, Equatable {
    case invalidResponse
    case http(statusCode: Int, message: String)

    public var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The server returned an invalid response."
        case .http(_, let message):
            return message
        }
    }
}

public actor APIClient {
    private let baseURL: URL
    private let sessionStore: any SessionStore
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var cookieJar: CookieJar

    public init(
        baseURL: URL,
        sessionStore: any SessionStore = KeychainSessionStore(),
        configuration: URLSessionConfiguration = .ephemeral
    ) {
        configuration.httpShouldSetCookies = false
        configuration.httpCookieAcceptPolicy = .never

        self.baseURL = baseURL
        self.sessionStore = sessionStore
        self.session = URLSession(configuration: configuration)
        self.cookieJar = (try? sessionStore.load()) ?? CookieJar()
    }

    public func get<Response: Decodable>(
        _ type: Response.Type,
        path: String,
        query: [URLQueryItem] = [],
        headers: [String: String] = [:]
    ) async throws -> Response {
        let result = try await request(
            method: "GET",
            path: path,
            query: query,
            headers: headers,
            body: nil
        )
        return try decoder.decode(Response.self, from: result.data)
    }

    public func post<RequestBody: Encodable, Response: Decodable>(
        _ type: Response.Type,
        path: String,
        body: RequestBody
    ) async throws -> Response {
        let result = try await request(method: "POST", path: path, query: [], body: AnyEncodable(body))
        return try decoder.decode(Response.self, from: result.data)
    }

    public func post(path: String) async throws {
        _ = try await request(method: "POST", path: path, query: [], body: nil)
    }

    public func delete<RequestBody: Encodable, Response: Decodable>(
        _ type: Response.Type,
        path: String,
        body: RequestBody
    ) async throws -> Response {
        let result = try await request(method: "DELETE", path: path, query: [], body: AnyEncodable(body))
        return try decoder.decode(Response.self, from: result.data)
    }

    func request(
        method: String,
        path: String,
        query: [URLQueryItem] = [],
        headers: [String: String] = [:],
        body: AnyEncodable?
    ) async throws -> APIResponse {
        var components = URLComponents(
            url: baseURL.appending(path: path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))),
            resolvingAgainstBaseURL: false
        )
        if query.isEmpty == false {
            components?.queryItems = query
        }

        guard let url = components?.url else {
            throw APIClientError.invalidResponse
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }

        if let header = cookieJar.headerValue {
            request.setValue(header, forHTTPHeaderField: "Cookie")
        }

        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }

        let responseCookies = responseCookieHeaders(from: httpResponse)
            .flatMap(splitSetCookieHeader)
            .compactMap(makeStoredCookie(from:))

        cookieJar = cookieJar.merging(responseCookies)
        try persistCookies()

        guard (200..<300).contains(httpResponse.statusCode) else {
            let message = decodeErrorMessage(from: data) ?? HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode)
            throw APIClientError.http(statusCode: httpResponse.statusCode, message: message)
        }

        return APIResponse(statusCode: httpResponse.statusCode, data: data)
    }

    public func clearCookies() throws {
        cookieJar = CookieJar()
        try sessionStore.clear()
    }

    private func persistCookies() throws {
        if cookieJar.isEmpty {
            try sessionStore.clear()
            return
        }
        try sessionStore.save(cookieJar)
    }

    private func decodeErrorMessage(from data: Data) -> String? {
        if let envelope = try? decoder.decode(APIErrorEnvelope.self, from: data) {
            return envelope.bestMessage
        }

        if let message = String(data: data, encoding: .utf8), message.isEmpty == false {
            return message
        }

        return nil
    }

    private func responseCookieHeaders(from response: HTTPURLResponse) -> [String] {
        response.allHeaderFields.compactMap { pair in
            guard
                let key = pair.key as? String,
                key.caseInsensitiveCompare("Set-Cookie") == .orderedSame,
                let value = pair.value as? String
            else {
                return nil
            }

            return value
        }
    }

    private func splitSetCookieHeader(_ header: String) -> [String] {
        let pattern = #",(?=\s*[^;,=\s]+=[^;,]+)"#
        guard let expression = try? NSRegularExpression(pattern: pattern) else {
            return [header]
        }

        let range = NSRange(header.startIndex..<header.endIndex, in: header)
        let parts = expression.split(in: header, range: range)
        return parts
            .map { String(header[$0]).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { $0.isEmpty == false }
    }

    private func makeStoredCookie(from rawHeader: String) -> CookieJar.StoredCookie? {
        let firstSegment = rawHeader.split(separator: ";", maxSplits: 1).first?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let parts = firstSegment.split(separator: "=", maxSplits: 1).map(String.init)
        guard parts.count == 2 else {
            return nil
        }

        return .init(name: parts[0], value: parts[1])
    }
}

private extension NSRegularExpression {
    func split(in string: String, range: NSRange) -> [Range<String.Index>] {
        let matches = matches(in: string, range: range)
        guard matches.isEmpty == false else {
            return [Range(range, in: string)!]
        }

        var ranges: [Range<String.Index>] = []
        var currentLocation = range.location

        for match in matches {
            let nextRange = NSRange(location: currentLocation, length: match.range.location - currentLocation)
            if let resolvedRange = Range(nextRange, in: string) {
                ranges.append(resolvedRange)
            }
            currentLocation = match.range.location + match.range.length
        }

        let tailRange = NSRange(location: currentLocation, length: range.location + range.length - currentLocation)
        if let resolvedTailRange = Range(tailRange, in: string) {
            ranges.append(resolvedTailRange)
        }

        return ranges
    }
}
